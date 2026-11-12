import { init } from "./widget";

// Runs on the customer's page. `currentScript` is this very <script> tag.
void init(document.currentScript as HTMLScriptElement | null);
