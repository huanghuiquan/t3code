import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import IconFolder from "@tabler/icons-react-native/IconFolder";
import IconFolderOpen from "@tabler/icons-react-native/IconFolderOpen";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import { useGT } from "gt-react-native";
import { Pressable, View } from "react-native";
import { withUniwind } from "uniwind";

import { AppText } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { useEnvironmentScope } from "../../state/session";
import type { ProjectHeader } from "./projectThreadList";

const ClosedFolder = withUniwind(IconFolder);
const OpenFolder = withUniwind(IconFolderOpen);

export function ProjectThreadHeader(props: {
  readonly item: ProjectHeader;
  readonly project: EnvironmentProject | undefined;
  readonly environmentLabel: string | undefined;
  readonly onToggle: () => void;
  readonly onCreate: (project: EnvironmentProject) => void;
}) {
  const gt = useGT();
  const { item, project } = props;
  const Folder = item.expanded ? OpenFolder : ClosedFolder;
  const canCreate = useEnvironmentScope(item.environmentId, AuthOrchestrationOperateScope);
  return (
    <View className="min-h-[38px] flex-row items-center pl-5 pr-2">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: item.expanded }}
        className="min-h-[38px] min-w-0 flex-1 flex-row items-center gap-2"
        onPress={props.onToggle}
      >
        <Folder size={15} strokeWidth={1.5} colorClassName="accent-foreground-tertiary" />
        <AppText className="flex-1 text-xs text-foreground-muted" numberOfLines={1}>
          {project?.title || gt("No project")}
        </AppText>
        <AppText className="max-w-[45%] text-2xs text-foreground-tertiary" numberOfLines={1}>
          {props.environmentLabel ? props.environmentLabel + " · " : ""}
          {item.count}
        </AppText>
      </Pressable>
      {project && canCreate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={gt("New chat")}
          accessibilityHint={project.title}
          className="h-[38px] w-10 items-center justify-center"
          onPress={() => props.onCreate(project)}
        >
          <SymbolView
            name="square.and.pencil"
            size={15}
            tintColorClassName="accent-foreground-muted"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
