import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId } from "@t3tools/contracts";
import { useGT } from "gt-react-native";
import { Pressable, View } from "react-native";

import { AppText } from "../../components/ui/AppText";
import { Menu } from "../../components/ui/Menu";
import { SymbolView } from "../../components/ui/AppSymbol";
import { scopedProjectKey } from "../../lib/scopedEntities";
import type { HomeListFilterMenuEnvironment } from "./home-list-filter-menu";
import type { HomeListMode } from "./projectThreadList";

export function ThreadListFilters(props: {
  readonly environments: ReadonlyArray<HomeListFilterMenuEnvironment>;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly projectLabel: string | undefined;
  readonly mode: HomeListMode;
  readonly onModeChange: (mode: HomeListMode) => void;
  readonly onSelectScope: (env: EnvironmentId | null, project: string | null) => void;
}) {
  const gt = useGT();
  const choices = new Map<
    string,
    { environmentId: EnvironmentId | null; projectKey: string | null }
  >();
  const choice = (
    environmentId: EnvironmentId | null,
    projectKey: string | null,
    title: string,
  ) => {
    const id = JSON.stringify([environmentId, projectKey]);
    choices.set(id, { environmentId, projectKey });
    return { id, title };
  };
  const actions = [
    choice(null, null, gt("All environments")),
    ...props.environments.map((environment) => ({
      title: environment.label,
      subactions: [
        choice(environment.environmentId, null, gt("All projects")),
        ...props.projects
          .filter(
            (project) => project.environmentId === environment.environmentId && !project.archivedAt,
          )
          .map((project) =>
            choice(
              project.environmentId,
              scopedProjectKey(project.environmentId, project.id),
              project.title,
            ),
          ),
      ],
    })),
  ];
  const environmentLabel = props.environments.find(
    (env) => env.environmentId === props.selectedEnvironmentId,
  )?.label;
  const label =
    [environmentLabel, props.projectLabel].filter(Boolean).join(" / ") || gt("All environments");
  return (
    <View className="min-h-10 flex-row items-center justify-between gap-2 px-5">
      <View className="min-w-0 flex-1">
        <Menu
          actions={actions}
          onPressAction={({ nativeEvent }) => {
            const scope = choices.get(nativeEvent.event);
            if (scope) props.onSelectScope(scope.environmentId, scope.projectKey);
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            className="min-h-10 flex-row items-center gap-1"
          >
            <AppText className="shrink text-xs text-foreground-muted" numberOfLines={1}>
              {label}
            </AppText>
            <SymbolView
              name="chevron.down"
              size={10}
              tintColorClassName="accent-foreground-muted"
            />
          </Pressable>
        </Menu>
      </View>
      {(["projects", "recent"] as const).map((mode) => (
        <Pressable
          key={mode}
          accessibilityRole="tab"
          accessibilityState={{ selected: props.mode === mode }}
          className="min-h-10 justify-center px-1"
          onPress={() => props.onModeChange(mode)}
        >
          <AppText
            className={
              props.mode === mode ? "text-xs text-foreground" : "text-xs text-foreground-muted"
            }
          >
            {mode === "projects" ? gt("Projects") : gt("Recently updated")}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
