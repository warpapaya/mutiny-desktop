import { contextBridge, ipcRenderer } from "electron";

import {
  PICKER_CANCEL_CHANNEL,
  PICKER_SELECT_CHANNEL,
} from "./native/screenPickerResult";

contextBridge.exposeInMainWorld("screenPicker", {
  select: (sourceId: string) => ipcRenderer.send(PICKER_SELECT_CHANNEL, sourceId),
  cancel: () => ipcRenderer.send(PICKER_CANCEL_CHANNEL),
});
