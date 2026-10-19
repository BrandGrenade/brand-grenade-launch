import { useState } from "react";
import { useHubClient } from "@/components/HubClientProvider";

/** Hub identity wins over stored briefs, search defaults and previous form state. */
export function useHubBrand(initialBrand = "") {
  const { hub, name } = useHubClient();
  const [brand, setBrand] = useState(initialBrand);
  return [hub && name ? name : brand, setBrand, Boolean(hub)] as const;
}