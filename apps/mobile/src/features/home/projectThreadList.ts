import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { resolveThreadActivityTimestamp } from "@t3tools/client-runtime/state/thread-sort";

import { scopedProjectKey } from "../../lib/scopedEntities";
import type { ThreadListV2ListItem } from "../threads/threadListV2";

export type HomeListMode = "projects" | "recent";

export interface ProjectHeader {
  readonly type: "project-header";
  readonly key: string;
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly count: number;
  readonly expanded: boolean;
}

export type HomeListItem = ThreadListV2ListItem | ProjectHeader;
type Conversation = Extract<ThreadListV2ListItem, { type: "v2-thread" | "v2-pending" }>;

export function buildProjectThreadList(
  items: ReadonlyArray<ThreadListV2ListItem>,
  mode: HomeListMode,
  collapsed: ReadonlySet<string>,
): HomeListItem[] {
  const conversations = items.flatMap((row) => {
    if (row.type !== "v2-thread" && row.type !== "v2-pending") return [];
    const source = row.type === "v2-thread" ? row.item.thread : row.pendingTask;
    const timestamp =
      row.type === "v2-thread"
        ? (resolveThreadActivityTimestamp(row.item.thread) ?? source.createdAt)
        : source.createdAt;
    return [{ row, source, timestamp: Date.parse(timestamp) || 0 }];
  });
  conversations.sort((a, b) => b.timestamp - a.timestamp || a.row.key.localeCompare(b.row.key));
  if (mode === "recent") return conversations.map(({ row }) => row);

  const groups = new Map<string, { header: Omit<ProjectHeader, "count">; rows: Conversation[] }>();
  for (const {
    row,
    source: { environmentId, projectId },
  } of conversations) {
    const key = scopedProjectKey(environmentId, projectId);
    let group = groups.get(key);
    if (!group) {
      group = {
        header: {
          type: "project-header",
          key: "project:" + key,
          environmentId,
          projectId,
          expanded: !collapsed.has(key),
        },
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  const result: HomeListItem[] = [];
  for (const { header, rows } of groups.values()) {
    result.push({ ...header, count: rows.length });
    if (header.expanded) result.push(...rows);
  }
  return result;
}
