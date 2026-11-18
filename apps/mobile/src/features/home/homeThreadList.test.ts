import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildHomeProjectScopes, findHomeProjectScope } from "./homeThreadList";
import { makeThreadShellFixture } from "../../test-fixtures";
import { buildProjectThreadList } from "./projectThreadList";
import { buildThreadListV2Items, buildThreadListV2ListItems } from "../threads/threadListV2";

function makeProject(
  input: Partial<EnvironmentProject> & Pick<EnvironmentProject, "environmentId" | "id" | "title">,
): EnvironmentProject {
  return {
    workspaceRoot: `/workspaces/${input.id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    scripts: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...input,
  };
}

function makeThread(
  input: Partial<EnvironmentThreadShell> &
    Pick<EnvironmentThreadShell, "environmentId" | "id" | "projectId" | "title">,
): EnvironmentThreadShell {
  return makeThreadShellFixture({
    modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...input,
  });
}

describe("home project scopes", () => {
  it("filters threads across both scratch hosts while retaining the selected environment boundary", () => {
    const localEnvironmentId = EnvironmentId.make("local");
    const remoteEnvironmentId = EnvironmentId.make("remote");
    const projects = [
      makeProject({
        environmentId: localEnvironmentId,
        id: ProjectId.make("scratch-local"),
        title: "No project",
        workspaceRoot: "/local/scratch",
        isScratch: true,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("scratch-remote"),
        title: "No project",
        workspaceRoot: "/remote/scratch",
        isScratch: true,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("ordinary"),
        title: "No project",
      }),
    ];
    const threads = projects.map((project) =>
      makeThread({
        environmentId: project.environmentId,
        projectId: project.id,
        id: ThreadId.make(`thread-${project.id}`),
        title: project.id,
      }),
    );
    const scopes = buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: "separate",
    });
    expect(scopes).toHaveLength(2);
    const scratchScope = scopes.find((scope) => scope.representative.isScratch)!;
    const filtered = buildThreadListV2Items({
      threads,
      environmentId: null,
      projectRefs: scratchScope.projectRefs,
      searchQuery: "",
      now: "2026-06-01T00:00:00.000Z",
    });
    expect(filtered.items.map((item) => item.thread.id).sort()).toEqual(
      threads
        .slice(0, 2)
        .map((thread) => thread.id)
        .sort(),
    );
    const remoteScopes = buildHomeProjectScopes({
      projects,
      environmentId: remoteEnvironmentId,
      projectGroupingMode: "separate",
    });
    const remoteScratch = remoteScopes.find((scope) => scope.representative.isScratch)!;
    expect(remoteScratch.key).toBe(scratchScope.key);
    expect(remoteScratch.projectRefs).toEqual([
      { environmentId: remoteEnvironmentId, projectId: projects[1]!.id },
    ]);
    expect(
      buildThreadListV2Items({
        threads,
        environmentId: remoteEnvironmentId,
        projectRefs: remoteScratch.projectRefs,
        searchQuery: "",
        now: "2026-06-01T00:00:00.000Z",
      }).items.map((item) => item.thread.id),
    ).toEqual([threads[1]!.id]);
  });

  it("keeps repository identity from an older duplicate when the freshness winner lacks it", () => {
    const localEnvironmentId = EnvironmentId.make("environment-local");
    const remoteEnvironmentId = EnvironmentId.make("environment-remote");
    const repositoryIdentity = {
      canonicalKey: "github.com/pingdotgg/t3code",
      locator: {
        source: "git-remote" as const,
        remoteName: "origin",
        remoteUrl: "git@github.com:pingdotgg/t3code.git",
      },
    };
    const projects = [
      makeProject({
        environmentId: localEnvironmentId,
        id: ProjectId.make("project-local"),
        title: "t3code",
        repositoryIdentity,
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("project-remote-with-identity"),
        title: "t3code",
        workspaceRoot: "/remote/t3code",
        repositoryIdentity,
        updatedAt: "2026-06-01T00:00:00.000Z",
      }),
      makeProject({
        environmentId: remoteEnvironmentId,
        id: ProjectId.make("project-remote-fresh"),
        title: "t3code",
        workspaceRoot: "/remote/t3code/",
        updatedAt: "2026-06-02T00:00:00.000Z",
      }),
    ];

    const scopes = buildHomeProjectScopes({
      projects,
      environmentId: null,
      projectGroupingMode: "repository",
    });

    expect(scopes).toHaveLength(1);
    expect(scopes[0]?.representative.id).toBe(ProjectId.make("project-local"));
    expect(scopes[0]?.projects.map((project) => project.id)).toContain(
      ProjectId.make("project-remote-fresh"),
    );
    expect(scopes[0]?.projectRefs).toHaveLength(3);
  });

  it("does not merge unrelated repositories that share a title", () => {
    const environmentId = EnvironmentId.make("environment-1");
    const projects = ["one", "two"].map((name) =>
      makeProject({
        environmentId,
        id: ProjectId.make(`project-${name}`),
        title: "app",
        repositoryIdentity: {
          canonicalKey: `github.com/example/${name}`,
          locator: {
            source: "git-remote" as const,
            remoteName: "origin",
            remoteUrl: `git@github.com:example/${name}.git`,
          },
        },
      }),
    );

    expect(
      buildHomeProjectScopes({
        projects,
        environmentId: null,
        projectGroupingMode: "repository",
      }),
    ).toHaveLength(2);
  });

  it("orders project sections by activity and collapses only the project on the chosen host", () => {
    const mac = EnvironmentId.make("mac");
    const cloud = EnvironmentId.make("cloud");
    const projectId = ProjectId.make("shared");
    const thread = (environmentId: EnvironmentId, id: string, day: string) =>
      makeThread({
        environmentId,
        projectId,
        id: ThreadId.make(id),
        title: id,
        updatedAt: `2026-06-${day}T16:00:00Z`,
      });
    const threads = [
      thread(mac, "old", "01"),
      thread(cloud, "other", "02"),
      thread(mac, "new", "03"),
    ];
    const layout = buildThreadListV2Items({
      threads,
      environmentId: null,
      searchQuery: "",
      now: "2026-06-04T16:00:00Z",
    });
    const rows = buildThreadListV2ListItems({ items: layout.items, pendingTasks: [] });
    const titles = (mode: "projects" | "recent", collapsed = new Set<string>()) =>
      buildProjectThreadList(rows, mode, collapsed).map((row) =>
        row.type === "v2-thread" ? row.item.thread.title : row.key,
      );
    expect(titles("projects")).toEqual([
      "project:mac:shared",
      "new",
      "old",
      "project:cloud:shared",
      "other",
    ]);
    const collapsed = new Set(["mac:shared"]);
    expect(titles("projects", collapsed)).toEqual([
      "project:mac:shared",
      "project:cloud:shared",
      "other",
    ]);
    expect(titles("recent", collapsed)).toEqual(["new", "other", "old"]);
  });

  it("prefers an exact scope key over a project ID that collides with it", () => {
    const environmentId = EnvironmentId.make("environment-local");
    const collidingProject = makeProject({
      environmentId,
      id: ProjectId.make("/workspaces/target"),
      title: "Colliding",
      workspaceRoot: "/workspaces/colliding",
    });
    const targetProject = makeProject({
      environmentId,
      id: ProjectId.make("project-target"),
      title: "Target",
      workspaceRoot: "/workspaces/target",
    });
    const scopes = buildHomeProjectScopes({
      projects: [collidingProject, targetProject],
      environmentId: null,
      projectGroupingMode: "separate",
    });
    const targetScope = scopes.find((scope) => scope.title === "Target");
    expect(scopes.map((scope) => scope.title)).toEqual(["Colliding", "Target"]);
    expect(targetScope?.key).toBe("environment-local:/workspaces/target");

    expect(findHomeProjectScope(scopes, "environment-local:/workspaces/target")).toBe(targetScope);
    expect(findHomeProjectScope(scopes, "environment-local:project-target")).toBe(targetScope);
    expect(findHomeProjectScope(scopes, "environment-local:missing")).toBeNull();
    expect(findHomeProjectScope(scopes, null)).toBeNull();
  });
});
