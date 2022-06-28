# [deno.land/x/ichat](https://deno.land/x/ichat)

A [Deno](https://deno.land) module for parsing macOS *.ichat archives.

**Status:** Not yet tested but "works on my machine"

## API

See the [deno.land](https://deno.land/x/ichat) page for API details.

## Examples

```ts
// You should @version this import
import * as ichat from "https://deno.land/x/ichat/mod.ts";

// Parses ./messages.ichat
const messages = await ichat.parseFile("messages.ichat");

// Parses ./messages.ichat, relative to the parent folder of the current script
const messagesRel = await ichat.parseFile("messages.ichat", import.meta.url);

// Synchronous version
const messagesSync = ichat.parseFileSync("messages.ichat", import.meta.url);

// If the ichat file has already been loaded into memory, use parseBuffer
const messagesData: Uint8Array = await fetchIchat(/*...*/);
const messagesBuf = ichat.parseBuffer(messagesData);
```

## Command line

To parse ichat archives from the command line, you can `deno install` the
`bin/ichat_json.ts` script:

```sh
deno install --allow-read --allow-write https://deno.land/x/ichat/bin/ichat_json.ts
```

This will install the `ichat_json` command. The name of the installed command
can be customized with the `--name/-n` flag. See `deno install --help` for more
info.

### Usage

The following will extract messages from `./messages.ichat` and print the output
JSON to the command line. Message attachments will be ignored.

```sh
ichat_json messages.ichat
```

The following will store the messages into `./messages.json` with attachments
saved to the `./attachments` folder.

```sh
ichat_json messages.ichat -o messages.json -a attachments
```

See `ichat_json --help` for more usage information.

## Contributing

Contributions of any kind are welcome, just open a [GitHub
issue](https://github.com/connorlogin/ichat/issues/new).

I'm currently looking for data-rich, well-known ichat archives to use as test
data. If you have some you're willing to provide or know of some on the internet
somewhere, please let me know.