import { isNativePlatform } from "@/lib/native/platform";
import { buildExportBundle, parseExportBundle } from "@/lib/storage/repository";
import { useLibraryStore } from "@/stores/library";
import { getSettingsSnapshot, useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";

/** Backup and restore of everything stored on this device, as one portable JSON file. */

function triggerDownload(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadBackup(): Promise<void> {
  const { finished, live, achievements } = useLibraryStore.getState();
  const bundle = buildExportBundle({ settings: getSettingsSnapshot(), finished, live, achievements });
  const filename = `sudoku-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(bundle);
  const toast = useUiStore.getState().toast;

  if (isNativePlatform()) {
    // A web view cannot save downloads, so write the file and open the system share sheet
    // (save to Files or Drive, send to another device, ...).
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);
      const written = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: "Sudoku backup", files: [written.uri], dialogTitle: "Save your backup" });
    } catch {
      toast("Couldn't create the backup", { tone: "error" });
    }
    return;
  }

  triggerDownload(filename, json);
  toast("Backup saved", { tone: "success", detail: `${finished.length + live.length} games exported.` });
}

/** Merge a backup file into this device. Existing games are never lost; conflicts follow the sync rules. */
export async function restoreBackup(file: File | undefined): Promise<void> {
  if (!file) return;
  const toast = useUiStore.getState().toast;
  const bundle = parseExportBundle(await file.text());
  if (!bundle) {
    toast("That file isn't a Sudoku backup", { tone: "error" });
    return;
  }
  const library = useLibraryStore.getState();
  const result = library.mergeRemote([...bundle.finished, ...bundle.live]);
  library.mergeAchievementList(bundle.achievements);
  library.reevaluateAchievements();
  if (bundle.settings.updatedAt > getSettingsSnapshot().updatedAt) useSettingsStore.getState().replace(bundle.settings);
  toast("Backup imported", {
    tone: "success",
    detail: `${result.adopted.length} new ${result.adopted.length === 1 ? "game" : "games"} added.`,
  });
}
