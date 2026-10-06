import type { Settings, CustomColors } from "./types";
import type { Keyframe } from "./animation";
import { createId } from "./id";

const projectKey = "frame-studio.project.v1";
export interface SavedProject {
  version: 1;
  settings: Settings;
  customColors?: CustomColors;
  assets: { screen: string | null; bg: string | null };
  mediaType: "image" | "video";
  fileName: string;
  imageInfo: string;
  imageColor: string;
  time: number;
  duration: number;
  loop: boolean;
  frames: Keyframe[];
  selected: string | null;
  quality: number;
  selectedPose: number;
  pasteTarget: "screen" | "bg";
  moveMode: boolean;
  sideOpen: boolean;
}

let database: Promise<IDBDatabase> | undefined;
let savedAssets: SavedProject["assets"] = { screen: null, bg: null };
let savedJson: string | null = null;
function openDatabase() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("frame-studio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("assets");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
  }));
}

export async function saveAsset(file: Blob): Promise<string> {
  const db = await openDatabase();
  const id = createId();
  // Publish the asset reference only after the blob transaction is durable.
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("assets", "readwrite");
    transaction.objectStore("assets").put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
  return id;
}

export async function removeAsset(id: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("assets", "readwrite");
    transaction.objectStore("assets").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readAsset(id: string | null): Promise<Blob | null> {
  if (!id) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("assets").objectStore("assets").get(id);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}

export async function loadProject() {
  const json = localStorage.getItem(projectKey);
  if (!json) return null;
  const project: SavedProject = JSON.parse(json);
  if (
    project.version !== 1 ||
    !project.settings ||
    !project.assets ||
    !Array.isArray(project.frames) ||
    !Number.isFinite(project.time) ||
    !(project.duration >= 1 && project.duration <= 60)
  ) {
    throw new Error("无法读取上次的编辑内容");
  }
  const [screen, bg] = await Promise.all([
    readAsset(project.assets.screen),
    readAsset(project.assets.bg),
  ]);
  savedAssets = project.assets;
  savedJson = json;
  return { project, screen, bg };
}

export function saveProject(project: SavedProject) {
  // Object URLs expire on navigation. Only durable blob IDs go into the snapshot.
  const json = JSON.stringify({
    ...project,
    settings: { ...project.settings, bgImage: "" },
  });
  if (json === savedJson) return;
  localStorage.setItem(projectKey, json);
  savedJson = json;
  const retained = new Set(Object.values(project.assets));
  for (const id of Object.values(savedAssets)) {
    if (id && !retained.has(id)) void removeAsset(id).catch(() => {});
  }
  savedAssets = { ...project.assets };
}
