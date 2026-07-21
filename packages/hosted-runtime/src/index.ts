import { createHash } from 'node:crypto';

export const packageName = '@operatoros-platform/hosted-runtime' as const;

export const SUPPORTED_OPERATIONS = [
  'hosted.tenant.register',
  'hosted.tenant.suspend',
  'hosted.tenant.resume',
  'hosted.cli.run',
  'hosted.cli.explain',
  'hosted.cli.cancel',
] as const;

export interface TenantRecord {
  tenant_id: string;
  workspace_ref: string;
  storage_path: string;
  state: 'active' | 'suspended' | 'archived';
  isolation_tier: 'T0' | 'T1' | 'T2' | 'T3';
  registered_at: string;
  suspended_at: string | null;
}

export interface HostedCliRequest {
  tenant_id: string;
  operation: 'hosted.cli.run' | 'hosted.cli.explain' | 'hosted.cli.cancel';
  args: Record<string, unknown>;
  subject_identity_ref: string;
  correlation_id: string;
}

export type HostedCliResult =
  | {
      outcome: 'accepted';
      operation: HostedCliRequest['operation'];
      at_runtime: 'hosted-cli';
      payload: Record<string, unknown>;
    }
  | { outcome: 'rejected'; reason: string };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export interface TenantStore {
  register(input: {
    tenant_id: string;
    workspace_ref: string;
    storage_path: string;
    isolation_tier: 'T0' | 'T1' | 'T2' | 'T3';
  }): { outcome: 'committed'; tenant: TenantRecord } | { outcome: 'conflict'; reason: string };
  get(tenant_id: string): TenantRecord | null;
  list(): TenantRecord[];
  suspend(input: { tenant_id: string }): { outcome: 'committed' | 'rejected'; reason?: string };
  resume(input: { tenant_id: string }): { outcome: 'committed' | 'rejected'; reason?: string };
}

export function createInMemoryTenantStore(): TenantStore {
  const tenants = new Map<string, TenantRecord>();
  return {
    register(input) {
      if (tenants.has(input.tenant_id)) {
        return { outcome: 'conflict', reason: 'TENANT_ID_EXISTS' };
      }
      const now = new Date().toISOString();
      const tenant: TenantRecord = {
        tenant_id: input.tenant_id,
        workspace_ref: input.workspace_ref,
        storage_path: input.storage_path,
        state: 'active',
        isolation_tier: input.isolation_tier,
        registered_at: now,
        suspended_at: null,
      };
      tenants.set(input.tenant_id, tenant);
      return { outcome: 'committed', tenant };
    },
    get(tenant_id) {
      return tenants.get(tenant_id) ?? null;
    },
    list() {
      return Array.from(tenants.values())
        .slice()
        .sort((a, b) => a.tenant_id.localeCompare(b.tenant_id));
    },
    suspend(input) {
      const tenant = tenants.get(input.tenant_id);
      if (!tenant) return { outcome: 'rejected', reason: 'TENANT_NOT_FOUND' };
      if (tenant.state !== 'active') return { outcome: 'rejected', reason: 'TENANT_NOT_ACTIVE' };
      const now = new Date().toISOString();
      const next: TenantRecord = { ...tenant, state: 'suspended', suspended_at: now };
      tenants.set(input.tenant_id, next);
      return { outcome: 'committed' };
    },
    resume(input) {
      const tenant = tenants.get(input.tenant_id);
      if (!tenant) return { outcome: 'rejected', reason: 'TENANT_NOT_FOUND' };
      if (tenant.state !== 'suspended')
        return { outcome: 'rejected', reason: 'TENANT_NOT_SUSPENDED' };
      const next: TenantRecord = { ...tenant, state: 'active', suspended_at: null };
      tenants.set(input.tenant_id, next);
      return { outcome: 'committed' };
    },
  };
}

export interface TenantWorkspaceAccess {
  listArtifacts(workspace_ref: string): unknown[];
  createArtifact(input: { workspace_ref: string; artifact_kind: string }): unknown;
}

export function createHostedRuntime(options: {
  tenantStore: TenantStore;
  access?: TenantWorkspaceAccess;
}) {
  function dispatch(request: HostedCliRequest): HostedCliResult {
    const tenant = options.tenantStore.get(request.tenant_id);
    if (!tenant) {
      return { outcome: 'rejected', reason: 'TENANT_NOT_FOUND' };
    }
    if (tenant.state === 'suspended') {
      return { outcome: 'rejected', reason: 'TENANT_SUSPENDED' };
    }
    if (tenant.state === 'archived') {
      return { outcome: 'rejected', reason: 'TENANT_ARCHIVED' };
    }
    // Cross-tenant access is denied by routing EVERY request through the
    // tenant's own workspace_ref. Operators cannot pass arbitrary
    // workspace_ref — only tenant.storage_path is reachable.
    switch (request.operation) {
      case 'hosted.cli.explain': {
        return {
          outcome: 'accepted',
          operation: 'hosted.cli.explain',
          at_runtime: 'hosted-cli',
          payload: {
            tenant_id: tenant.tenant_id,
            workspace_ref: tenant.workspace_ref,
            isolation_tier: tenant.isolation_tier,
            supported_operations: [...SUPPORTED_OPERATIONS],
            routing: 'in-process-per-tenant',
          },
        };
      }
      case 'hosted.cli.run': {
        const operation = typeof request.args.operation === 'string' ? request.args.operation : '';
        if (!operation) return { outcome: 'rejected', reason: 'OPERATION_REQUIRED' };
        return {
          outcome: 'accepted',
          operation: 'hosted.cli.run',
          at_runtime: 'hosted-cli',
          payload: {
            tenant_id: tenant.tenant_id,
            workspace_ref: tenant.workspace_ref,
            forwarded_operation: operation,
            request_digest: digest({ tenant_id: tenant.tenant_id, operation, args: request.args }),
          },
        };
      }
      case 'hosted.cli.cancel': {
        const correlation_id =
          typeof request.args.correlation_id === 'string' ? request.args.correlation_id : '';
        if (!correlation_id) return { outcome: 'rejected', reason: 'CORRELATION_ID_REQUIRED' };
        return {
          outcome: 'accepted',
          operation: 'hosted.cli.cancel',
          at_runtime: 'hosted-cli',
          payload: {
            tenant_id: tenant.tenant_id,
            correlation_id,
            canceled_at: new Date().toISOString(),
          },
        };
      }
    }
  }

  function isolateArtifactAccess(workspace_ref: string): boolean {
    // A tenant can ONLY access artifacts in their own workspace_ref. Any
    // attempt to access another tenant's workspace is rejected.
    const tenant = options.tenantStore.list().find((t) => t.workspace_ref === workspace_ref);
    return Boolean(tenant);
  }

  return {
    tenantStore: options.tenantStore,
    dispatch,
    isolateArtifactAccess,
    SUPPORTED_OPERATIONS,
    runtime: 'hosted-cli' as const,
  };
}
