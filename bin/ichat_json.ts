// Copyright 2022 Connor Logan. All rights reserved. MIT License.

import * as path from "https://deno.land/std@0.145.0/path/mod.ts";
import * as flags from "https://deno.land/std@0.145.0/flags/mod.ts";
import { parseFile } from "../mod.ts";

if (import.meta.main) {
  const args = flags.parse(Deno.args);
  if (!args._[0] || "help" in args || "h" in args) {
    console.log(`
Parse macOS *.ichat archives into JSON files

INSTALL:
  deno install --allow-read --allow-write https://deno.land/x/ichat/bin/ichat_json.ts

USAGE:
  ichat_json (input) [options]

OPTIONS:
  --output, -o       <FILE>  Path to the output JSON file. If omitted, the JSON
                             will be written to standard output
  --attachments, -a  <DIR>   Path to the folder where message attachments will
                             be stored. If omitted, attachments will be dropped

NOTES:
  * This is a reverse-engineered solution. There's probably some bugs.
  * If attachments are being saved, the attachment's "data" property in the
    output JSON is its filename inside the attachments folder
    `.trim());
    
    if ("help" in args || "h" in args) {
      Deno.exit(0);
    }
    Deno.exit(1);
  }

  const input = args._[0].toString();
  const attachments = (args.attachments ?? args.a ?? "").toString();
  let output = (args.output ?? args.o ?? "").toString();

  const messages = await parseFile(input);
  const messagesJson = messages as any[];
  try {
    await Deno.mkdir(attachments);
  } catch {
    // The directory already exists
  }

  if (attachments) {
    for (let mi = 0; mi < messages.length; mi++) {
      const m = messages[mi];
      for (let ai = 0; ai < m.attachments.length; ai++) {
        const a = m.attachments[ai];
        let filename = m.time.toISOString().split(".")[0]
          .replaceAll(":", "")
          .replaceAll("-", "")
          .replaceAll("T", "");
        filename += "_" + m.sender.replaceAll(":", "-");
        filename += "_" + a.filename;
        await Deno.writeFile(path.join(attachments, filename), a.data);
        messagesJson[mi].attachments[ai].data = filename;
      }
    }
  } else {
    for (let mi = 0; mi < messages.length; mi++) {
      delete messagesJson[mi].attachments;
    }
  }
  
  if (output) {
    await Deno.writeTextFile(output, JSON.stringify(messagesJson, null, 2));
  } else {
    console.log(JSON.stringify(messagesJson, null, 2));
  }
}