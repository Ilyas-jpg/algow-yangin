// Çözümleyici kancasını test koşucusuna tanıtır (node --import ./test/register.mjs)
import { register } from "node:module";
register("./resolver.mjs", import.meta.url);
