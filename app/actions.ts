"use server";

import { processSupportQuery } from "../src/lib/query-processing";

export async function submitSupportQuery(formData: FormData) {
  return processSupportQuery(formData);
}
