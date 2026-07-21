import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { publicContractVersion } from '@operatoros-platform/contracts';

export const packageName = '@operatoros-platform/distributed-coordination' as const;

export const SUPPORTED_OPERATIONS = [
  'distributed.peer.register',
  'distributed.peer.deregister',
  'distributed.checkpoint.anchor',
  'distributed.snapshot.reconcile',
  'distributed.consistency.verify',
] as const;

export interface PeerRecord {
  peer_id: string;
  host: string;
  port: number;
  role: 'primary' | 'replica';
  state: 'registered' | 'draining' | 'offline';
  registered_at: string;
  last_seen_at: string;
}

export interface CheckpointAnchor {
  checkpoint_ref: string;
  workspace_ref: string;
  run_ref: string;
  cursor: number;
  payload_digest: string;
  anchored_at: string;
  peer_id: string;
  fencing_token: number;
}

export interface ReconciliationVerdict {
  workspace_ref: string;
  peers_compared: string[];
  consistent: boolean;
  conflicting_checkpoints: {
    checkpoint_ref: string;
    peer_payload_digests: { peer_id: string; payload_digest: string }[];
  }[];
  decided_at: string;
}

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

const SCHEMA_VERSION = publicContractVersion;

export function createSqliteDistributedCoordination(options: { databasePath: string }) {
  const database = new DatabaseSync(options.databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS peers (
      peer_id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      role TEXT NOT NULL,
      state TEXT NOT NULL,
      registered_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS checkpoint_anchors (
      checkpoint_ref TEXT NOT NULL,
      workspace_ref TEXT NOT NULL,
      run_ref TEXT NOT NULL,
      cursor INTEGER NOT NULL,
      payload_digest TEXT NOT NULL,
      anchored_at TEXT NOT NULL,
      peer_id TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      entity_schema_version TEXT NOT NULL,
      PRIMARY KEY (checkpoint_ref, peer_id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS anchor_by_workspace
      ON checkpoint_anchors(workspace_ref, cursor);
  `);

  let fencingSequence = 0;

  function nextFencingToken(): number {
    fencingSequence += 1;
    return fencingSequence;
  }

  function registerPeer(input: {
    peer_id: string;
    host: string;
    port: number;
    role: 'primary' | 'replica';
  }): { outcome: 'committed'; peer: PeerRecord } | { outcome: 'conflict'; reason: string } {
    const existing = database
      .prepare('SELECT peer_id FROM peers WHERE peer_id = ?')
      .get(input.peer_id);
    if (existing !== undefined) {
      return { outcome: 'conflict', reason: 'PEER_ID_EXISTS' };
    }
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO peers VALUES (?, ?, ?, ?, 'registered', ?, ?)`)
        .run(input.peer_id, input.host, input.port, input.role, now, now);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      peer: {
        peer_id: input.peer_id,
        host: input.host,
        port: input.port,
        role: input.role,
        state: 'registered',
        registered_at: now,
        last_seen_at: now,
      },
    };
  }

  function deregisterPeer(input: { peer_id: string }): {
    outcome: 'committed' | 'rejected';
    reason?: string;
  } {
    const row = database.prepare('SELECT state FROM peers WHERE peer_id = ?').get(input.peer_id) as
      { state: string } | undefined;
    if (!row) return { outcome: 'rejected', reason: 'PEER_NOT_FOUND' };
    const now = new Date().toISOString();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`UPDATE peers SET state = 'offline', last_seen_at = ? WHERE peer_id = ?`)
        .run(now, input.peer_id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { outcome: 'committed' };
  }

  function getPeer(peer_id: string): PeerRecord | null {
    const row = database.prepare('SELECT * FROM peers WHERE peer_id = ?').get(peer_id) as
      | {
          peer_id: string;
          host: string;
          port: number;
          role: 'primary' | 'replica';
          state: 'registered' | 'draining' | 'offline';
          registered_at: string;
          last_seen_at: string;
        }
      | undefined;
    if (!row) return null;
    return row;
  }

  function listPeers(): PeerRecord[] {
    return database
      .prepare('SELECT * FROM peers WHERE state = ?')
      .all('registered') as unknown as PeerRecord[];
  }

  function anchorCheckpoint(input: {
    checkpoint_ref: string;
    workspace_ref: string;
    run_ref: string;
    cursor: number;
    payload: unknown;
    peer_id: string;
  }): { outcome: 'committed'; anchor: CheckpointAnchor } | { outcome: 'rejected'; reason: string } {
    const peer = database
      .prepare('SELECT state FROM peers WHERE peer_id = ?')
      .get(input.peer_id) as { state: string } | undefined;
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    if (!peer || peer.state !== 'registered') {
      return { outcome: 'rejected', reason: 'PEER_NOT_REGISTERED' };
    }
    const now = new Date().toISOString();
    const payloadDigest = digest(input.payload);
    const fencing = nextFencingToken();
    database.exec('BEGIN IMMEDIATE');
    try {
      database
        .prepare(`INSERT INTO checkpoint_anchors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          input.checkpoint_ref,
          input.workspace_ref,
          input.run_ref,
          input.cursor,
          payloadDigest,
          now,
          input.peer_id,
          fencing,
          SCHEMA_VERSION,
        );
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return {
      outcome: 'committed',
      anchor: {
        checkpoint_ref: input.checkpoint_ref,
        workspace_ref: input.workspace_ref,
        run_ref: input.run_ref,
        cursor: input.cursor,
        payload_digest: payloadDigest,
        anchored_at: now,
        peer_id: input.peer_id,
        fencing_token: fencing,
      },
    };
  }

  function reconcileSnapshots(input: { workspace_ref: string }): ReconciliationVerdict {
    const anchors = database
      .prepare('SELECT * FROM checkpoint_anchors WHERE workspace_ref = ? ORDER BY cursor DESC')
      .all(input.workspace_ref) as {
      checkpoint_ref: string;
      workspace_ref: string;
      run_ref: string;
      cursor: number;
      payload_digest: string;
      anchored_at: string;
      peer_id: string;
      fencing_token: number;
    }[];
    const byCheckpoint = new Map<
      string,
      { peer_id: string; payload_digest: string; fencing_token: number }[]
    >();
    for (const a of anchors) {
      const list = byCheckpoint.get(a.checkpoint_ref) ?? [];
      list.push({
        peer_id: a.peer_id,
        payload_digest: a.payload_digest,
        fencing_token: a.fencing_token,
      });
      byCheckpoint.set(a.checkpoint_ref, list);
    }
    const conflicts: ReconciliationVerdict['conflicting_checkpoints'] = [];
    for (const [checkpoint_ref, peerEntries] of byCheckpoint.entries()) {
      // Two anchors conflict if their payload digests differ across peers,
      // OR if the same (peer_id, payload_digest) was anchored multiple times
      // with different fencing_tokens (the highest wins).
      const digestSet = new Set(peerEntries.map((e) => e.payload_digest));
      if (digestSet.size > 1) {
        conflicts.push({ checkpoint_ref, peer_payload_digests: peerEntries });
        continue;
      }
      const tokens = peerEntries.map((e) => e.fencing_token);
      const maxToken = Math.max(...tokens);
      const minToken = Math.min(...tokens);
      if (maxToken !== minToken) {
        // Same payload but different fencing tokens => a stale contender;
        // the anchor with the highest fencing_token wins; report so the
        // caller can demote the stale one.
        conflicts.push({ checkpoint_ref, peer_payload_digests: peerEntries });
      }
    }
    const peersCompared = Array.from(new Set(anchors.map((a) => a.peer_id))).sort();
    return {
      workspace_ref: input.workspace_ref,
      peers_compared: peersCompared,
      consistent: conflicts.length === 0,
      conflicting_checkpoints: conflicts,
      decided_at: new Date().toISOString(),
    };
  }

  function verifyConsistency(input: { workspace_ref: string; peer_ids: string[] }): {
    consistent: boolean;
    anchors_compared: number;
    details: string;
  } {
    const anchors = database
      .prepare(
        'SELECT * FROM checkpoint_anchors WHERE workspace_ref = ? AND peer_id IN (' +
          input.peer_ids.map(() => '?').join(',') +
          ')',
      )
      .all(input.workspace_ref, ...input.peer_ids) as {
      checkpoint_ref: string;
      payload_digest: string;
    }[];
    const byCheckpoint = new Map<string, Set<string>>();
    for (const a of anchors) {
      const set = byCheckpoint.get(a.checkpoint_ref) ?? new Set<string>();
      set.add(a.payload_digest);
      byCheckpoint.set(a.checkpoint_ref, set);
    }
    let consistent = true;
    let compared = 0;
    for (const [, set] of byCheckpoint.entries()) {
      compared += 1;
      if (set.size > 1) {
        consistent = false;
      }
    }
    return {
      consistent,
      anchors_compared: compared,
      details: consistent ? 'all_anchors_match' : 'mismatch_detected',
    };
  }

  return {
    registerPeer,
    deregisterPeer,
    getPeer,
    listPeers,
    anchorCheckpoint,
    reconcileSnapshots,
    verifyConsistency,
    close: () => {
      database.close();
    },
  };
}
