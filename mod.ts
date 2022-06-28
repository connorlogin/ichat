// Copyright 2022 Connor Logan. All rights reserved. MIT License.

import * as z from "https://deno.land/x/zod@v3.17.3/mod.ts";
import * as bplist from "https://deno.land/x/bplist_parser@0.2.1/mod.ts";

const uidObjectSchema = z.object({
  id: z.number().int(),
});

const ichatSchema = z.object({
  $top: z.object({
    root: uidObjectSchema,
  }),
  $objects: z.array(z.any()),
});

const classedSchemas = [
  // NSArray and NSMutableArray
  z.object({
    'NS.objects': z.array(z.any()),
    $class: z.union([
      z.object({
        $classname: z.literal('NSArray'),
        $classes: z.tuple([
          z.literal('NSArray'),
          z.literal('NSObject'),
        ])
      }),
      z.object({
        $classname: z.literal('NSMutableArray'),
        $classes: z.tuple([
          z.literal('NSMutableArray'),
          z.literal('NSArray'),
          z.literal('NSObject'),
        ]),
      }),
    ]),
  }).transform(val => {
    return val['NS.objects'];
  }),

  // NSDictionary
  z.object({
    'NS.keys': z.array(z.string()),
    'NS.objects': z.array(z.any()),
    $class: z.object({
      $classname: z.literal('NSDictionary'),
      $classes: z.tuple([
        z.literal('NSDictionary'),
        z.literal('NSObject'),
      ]),
    }),
  }).refine(val => {
    return val['NS.keys'].length === val['NS.objects'].length;
  }).transform(val => {
    const res: Record<string, any> = {};
    for (let i = 0; i < val['NS.keys'].length; i++) {
      res[val['NS.keys'][i]] = val['NS.objects'][i];
    }
    return res;
  }),

  // NSString and NSMutableString
  z.object({
    'NS.string': z.string(),
    $class: z.union([
      z.object({
        $classname: z.literal('NSString'),
        $classes: z.tuple([
          z.literal('NSString'),
          z.literal('NSObject'),
        ]),
      }),
      z.object({
        $classname: z.literal('NSMutableString'),
        $classes: z.tuple([
          z.literal('NSMutableString'),
          z.literal('NSString'),
          z.literal('NSObject'),
        ])
      }),
    ]),
  }).transform(val => {
    return val['NS.string'];
  }),

  // NSDate
  z.object({
    'NS.time': z.number(), // Number of seconds since 1/1/2001
    $class: z.object({
      $classname: z.literal('NSDate'),
      $classes: z.tuple([
        z.literal('NSDate'),
        z.literal('NSObject'),
      ]),
    }),
  }).transform(val => {
    return new Date(
      // Apple stores NSDates as floating point numbers representing seconds
      // since the beginning of 2001 in UTC time
      new Date('2001-01-01T00:00:00.000+00:00').getTime() +
      val['NS.time'] * 1000
    );
  }),

  // NSData
  z.object({
    'NS.data': z.instanceof(Uint8Array),
    $class: z.union([
      z.object({
        $classname: z.literal('NSData'),
        $classes: z.tuple([
          z.literal('NSData'),
          z.literal('NSObject'),
        ]),
      }),
      z.object({
        $classname: z.literal('NSMutableData'),
        $classes: z.tuple([
          z.literal('NSMutableData'),
          z.literal('NSData'),
          z.literal('NSObject'),
        ]),
      }),
    ]),
  }).transform(val => {
    return val['NS.data'];
  }),

  // NSFileWrapper
  z.object({
    NSFileWrapperData: z.instanceof(Uint8Array),
    $class: z.object({
      $classname: z.literal('NSFileWrapper'),
      $classes: z.tuple([
        z.literal('NSFileWrapper'),
        z.literal('NSObject'),
      ]),
    }),
  }).transform(val => {
    return val.NSFileWrapperData;
  }),

  // NSTextAttachment
  z.object({
    NSFileWrapper: z.instanceof(Uint8Array),
    $class: z.object({
      $classname: z.literal('NSTextAttachment'),
      $classes: z.tuple([
        z.literal('NSTextAttachment'),
        z.literal('NSObject'),
      ]),
    }),
  }).transform(val => {
    return val.NSFileWrapper;
  }),

  // Classes that don't need special treatment and can just remove the $class
  // property
  z.object({
    $class: z.union([
      // NSAttributedString
      z.object({
        $classname: z.literal('NSAttributedString'),
        $classes: z.tuple([
          z.literal('NSAttributedString'),
          z.literal('NSObject'),
        ]),
      }),

      // NSMutableAttributedString
      z.object({
        $classname: z.literal('NSMutableAttributedString'),
        $classes: z.tuple([
          z.literal('NSMutableAttributedString'),
          z.literal('NSAttributedString'),
          z.literal('NSObject'),
        ]),
      }),

      // NSParagraphStyle
      z.object({
        $classname: z.literal('NSParagraphStyle'),
        $classes: z.tuple([
          z.literal('NSParagraphStyle'),
          z.literal('NSObject'),
        ]),
      }),

      // NSMutableParagraphStyle
      z.object({
        $classname: z.literal('NSMutableParagraphStyle'),
        $classes: z.tuple([
          z.literal('NSMutableParagraphStyle'),
          z.literal('NSParagraphStyle'),
          z.literal('NSObject'),
        ]),
      }),

      // Presentity
      z.object({
        $classname: z.literal('Presentity'),
        $classes: z.tuple([
          z.literal('Presentity'),
          z.literal('IMHandle'),
          z.literal('IMDirectlyObservableObject'),
          z.literal('NSObject'),
        ]),
      }),

      // InstantMessage
      z.object({
        $classname: z.literal('InstantMessage'),
        $classes: z.tuple([
          z.literal('InstantMessage'),
          z.literal('IMMessage'),
          z.literal('NSObject'),
        ]),
      }),

      // NSFont
      z.object({
        $classname: z.literal('NSFont'),
        $classes: z.tuple([
          z.literal('NSFont'),
          z.literal('NSObject'),
        ]),
      }),
    ]),
  }).passthrough().transform(val => {
    const res: Record<string, any> = val;
    delete res.$class;
    return res;
  }),
];

const partySchema = z.object({
  ID: z.string(),
  ServiceName: z.string(),
  AccountID: z.string(),
  AnonymousKey: z.boolean(),
  ServiceLoginID: z.string(),
}).passthrough();
const messageTextAttributesSchema = z.object({
  __kIMFileTransferGUIDAttributeName: z.string().optional(),
  __kIMFilenameAttributeName: z.string().optional(),
  NSAttachment: z.instanceof(Uint8Array).transform(data => {
    // This blog post was useful:
    // http://blog.simonrodriguez.fr/articles/2015/09/nsfilewrapper_serializedrepresentation.html#fnref3
    //
    // Generally, here's the steps to get a file from an NSAttachment:
    // 1. In the header, search for the 8 bytes that indicate the start of a
    //    file: 01 00 00 00 00 00 00 80
    // 2. The next four bytes are the size of the file
    // 3. The next four bytes are the size of the padding
    // 4. The next ???? bytes are the padding (00s), which should be ignored
    // 5. The next ???? bytes are the file
    // 6. The next ???? bytes are a directory listing for the serialized rtfd
    //    bundle, which should be ignored
    //
    // I'm only interested in singular file attachments for now. In those cases,
    // it appears that the 8 bytes to find in the header are located at offset
    // 93. This puts the file size at offset 101, and the padding size at offset
    // 105. I'll use this shortcut until I find edge cases where it breaks
    //
    // NOTE: This is a reverse-engineered solution and it probably won't work
    // for every attachment type, and odds are this format changed over time,
    // which means ichat archives from old versions of the Messages.app might
    // not work at all. If it fails for some reason, the returned data will be
    // partial/corrupt, or potentially an error will be thrown. If you get an
    // error, open a github issue to help this module improve:
    // https://github.com/connorlogin/ichat/issues/new
    const view = new DataView(data.buffer);
    const fileSize = view.getUint32(101, true);
    const paddingSize = view.getUint32(105, true);
    const begin = 109 + paddingSize;
    const end = begin + fileSize;
    return data.slice(begin, end);
  }).optional(),
  NSParagraphStyle: z.object({
    NSTabStops: z.any().nullable(),
    NSAlignment: z.number(),
    NSAllowsTighteningForTruncation: z.number(),
  }).optional(),
  NSFont: z.object({
    NSSize: z.number(),
    NSfFlags: z.number(),
    NSName: z.string(),
  }).optional(),
});
const messagesSchema = z.array(z.object({
  GUID: z.string(),
  Subject: partySchema,
  Sender: partySchema,
  OriginalMessage: z.string().optional(),
  MessageText: z.object({
    NSString: z.string(),
    NSAttributes: z.union([
      messageTextAttributesSchema,
      z.array(messageTextAttributesSchema),
    ]),
  }),
  Time: z.date(),
  BaseWritingDirection: z.number(),
  Error: z.any().nullable(),
  Flags: z.number(),
  IsInvitation: z.boolean(),
  IsRead: z.boolean(),
}).transform(val => {
  const res = {
    uuid: val.GUID,
    time: val.Time,
    sender: val.Sender.ServiceName + '|' +
      val.Sender.ServiceLoginID + '|' +
      // val.Sender.AccountID + '|' +
      val.Sender.ID
    ,
    subject: val.Subject.ServiceName + '|' +
      val.Subject.ServiceLoginID + '|' +
      // val.Subject.AccountID + '|' +
      val.Subject.ID
    ,
    message: val.OriginalMessage || null,
    attachments: [] as {
      filename: string
      data: Uint8Array
      // meta: {
      // 	__kIMFileTransferGUIDAttributeName?: string
      // },
    }[],
    // meta: {
    // 	isInvitation: val.IsInvitation,
    // 	isRead: val.IsRead,
    // 	flags: val.Flags,
    // 	baseWritingDirection: val.BaseWritingDirection,
    // 	error: val.Error,
    // },
  };

  const attributes = (
    Array.isArray(val.MessageText.NSAttributes) ? val.MessageText.NSAttributes
    : [val.MessageText.NSAttributes]
  );
  for (const a of attributes) {
    if (a.NSAttachment) {
      if (!res.attachments) {
        res.attachments = [];
      }
      res.attachments.push({
        filename: a.__kIMFilenameAttributeName || 'unknown',
        data: a.NSAttachment,
        // meta: {
        // 	__kIMFileTransferGUIDAttributeName: a.__kIMFileTransferGUIDAttributeName,
        // },
      });
    }
  }

  return res;
}));

/** Parsed ichat message. */
export interface Message {
  uuid: string;
  time: Date;
  sender: string;
  subject: string;
  message: string | null;
  attachments: Attachment[];
  // meta: {
  //   isInvitation: boolean;
  //   isRead: boolean;
  //   flags: number;
  //   baseWritingDirection: number;
  //   error?: unknown;
  // };
}

/** Image or file attachment sent with an ichat message. */
export interface Attachment {
  filename: string;
  data: Uint8Array;
  // meta: {
  //   __kIMFileTransferGUIDAttributeName?: string;
  // };
}

/**
 * Parses a macOS *.ichat file into a Deno-friendly format.
 *
 * If a cwd is provided, it will be used instead of the cwd of the Deno process
 * when opening the file. If it's a `file://` url string (e.g.
 * `import.meta.url`), the dirname of that file will be used.
 */
export async function parseFile(
  ichatPath: string,
  cwd?: string,
): Promise<Message[]> {
  const data = await bplist.parseFile(ichatPath, cwd);
  return parse(data);
}

/**
 * Parses a macOS *.ichat file into a Deno-friendly format, synchronously.
 *
 * If a cwd is provided, it will be used instead of the cwd of the Deno process
 * when opening the file. If it's a `file://` url string (e.g.
 * `import.meta.url`), the dirname of that file will be used.
 */
export function parseFileSync(
  ichatPath: string,
  cwd?: string,
): Message[] {
  const data = bplist.parseFileSync(ichatPath, cwd);
  return parse(data);
}

/** Parses a macOS *.ichat Uint8Array into a Deno-friendly format. */
export function parseBuffer(buf: Uint8Array): Message[] {
  return parse(buf);
}

function parse(data: unknown) {
  const { $top, $objects } = ichatSchema.parse(data);

  const ancestors = new Set<number>();
  const alreadyResolved = new Set<number>();
  const resolve = (val: any): any => {
    if (val === '$null') {
      return null;
    }
    if (typeof val !== 'object') {
      return val;
    }
    if (val instanceof Uint8Array) {
      return val;
    }

    const uidObjectParse = uidObjectSchema.safeParse(val);
    if (uidObjectParse.success) {
      const uid = uidObjectParse.data.id;
      if (alreadyResolved.has(uid)) {
        return $objects[uid];
      }
      if (ancestors.has(uid)) {
        throw new Error('Circular reference detected')
      }

      ancestors.add(uid);
      $objects[uid] = resolve($objects[uid]);
      ancestors.delete(uid);
      alreadyResolved.add(uid);

      for (const schema of classedSchemas) {
        const parse = schema.safeParse($objects[uid]);
        if (parse.success) {
          $objects[uid] = parse.data;
          return $objects[uid];
        }
      }

      return $objects[uid];
    }

    if (Array.isArray(val)) {
      const res: any[] = [];
      for (const v of val) {
        res.push(resolve(v));
      }
      return res;
    }
    const res: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      res[k] = resolve(val[k]);
    }
    return res;
  }
  
  const root = resolve($top.root);
  return messagesSchema.parse(root[2]);
}