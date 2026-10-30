import charge from "@/data/demos/charge.json";
import path from "@/data/demos/path.json";
import watney from "@/data/demos/watney.json";
import { RunSchema } from "./types";

export const demos = [charge, watney, path].map((demo) => RunSchema.parse(demo));
