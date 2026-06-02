import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.blgasm.pos",
  appName: "Blgasm POS",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#fbfff8",
  },
};

export default config;
