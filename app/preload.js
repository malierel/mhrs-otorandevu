const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Config & Token
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (data) => ipcRenderer.invoke("save-config", data),
  validateToken: (token) => ipcRenderer.invoke("validate-token", token),
  
  // MHRS Data Loaders
  loadCities: () => ipcRenderer.invoke("load-cities"),
  loadDistricts: (plaka) => ipcRenderer.invoke("load-districts", plaka),
  loadClinics: (plaka, ilceId) => ipcRenderer.invoke("load-clinics", { plaka, ilceId }),

  // Search Controls
  startSearch: (criteria) => ipcRenderer.invoke("start-search", criteria),
  stopSearch: () => ipcRenderer.invoke("stop-search"),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  closeWindow: () => ipcRenderer.send("close-window"), // Hides to tray

  // Event Listeners from Main Process
  onLog: (callback) => ipcRenderer.on("log-message", (_event, data) => callback(data)),
  onStatusUpdate: (callback) => ipcRenderer.on("status-update", (_event, data) => callback(data)),
  onAppointmentBooked: (callback) => ipcRenderer.on("appointment-booked", (_event, data) => callback(data)),
});
