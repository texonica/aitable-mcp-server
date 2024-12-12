#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Airtable, { FieldSet } from 'airtable';
import fetch from 'node-fetch';
import { z } from 'zod';

// Zod schemas for API responses
const BaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissionLevel: z.string(),
});

const ListBasesResponseSchema = z.object({
  bases: z.array(BaseSchema),
  offset: z.string().optional(),
});

const FieldOptionsSchema = z.object({
  isReversed: z.boolean().optional(),
  inverseLinkFieldId: z.string().optional(),
  linkedTableId: z.string().optional(),
  prefersSingleRecordLink: z.boolean().optional(),
}).passthrough(); // Allow additional properties we haven't specified

const FieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  options: FieldOptionsSchema.optional(),
});

const ViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const TableSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  primaryFieldId: z.string(),
  fields: z.array(FieldSchema),
  views: z.array(ViewSchema),
});

const BaseSchemaResponseSchema = z.object({
  tables: z.array(TableSchema),
});

// Zod schema for list_records tool arguments
const ListRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  maxRecords: z.number().optional(),
});

// Type for list_records arguments derived from the schema
type ListRecordsArgs = z.infer<typeof ListRecordsArgsSchema>;

const server = new Server(
  {
    name: 'airtable-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Please provide Airtable API key as a command-line argument');
  console.error('Usage: airtable-mcp-server <API_KEY>');
  process.exit(1);
}

const apiKey = args[0];
if (typeof apiKey !== 'string') {
  throw new Error('API key must be a string');
}

const airtable = new Airtable({ apiKey });

async function listBases() {
  const response = await fetch('https://api.airtable.com/v0/meta/bases', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bases: ${response.statusText}`);
  }

  const data = await response.json();
  return ListBasesResponseSchema.parse(data);
}

async function getBaseSchema(baseId: string) {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch base schema: ${response.statusText}`);
  }

  const data = await response.json();
  return BaseSchemaResponseSchema.parse(data);
}

const SCHEMA_PATH = 'schema';

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const { bases } = await listBases();
    
    // For each base, get its schema
    const resources = await Promise.all(bases.map(async (base) => {
      const schema = await getBaseSchema(base.id);
      
      return schema.tables.map((table) => ({
        uri: `airtable://${base.id}/${table.id}/${SCHEMA_PATH}`,
        mimeType: 'application/json',
        name: `${base.name}: ${table.name} schema`,
      }));
    }));

    // Flatten the array of arrays into a single array
    return {
      resources: resources.flat(),
    };
  } catch (error) {
    console.error('Error listing resources:', error);
    throw error;
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/airtable:\/\/([^/]+)\/([^/]+)\/schema/);
  
  if (!match || !match[1] || !match[2]) {
    throw new Error('Invalid resource URI');
  }

  const [, baseId, tableId] = match;

  try {
    const schema = await getBaseSchema(baseId);
    const table = schema.tables.find(t => t.id === tableId);
    
    if (!table) {
      throw new Error(`Table ${tableId} not found in base ${baseId}`);
    }
    
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            baseId: baseId,
            tableId: table.id,
            name: table.name,
            description: table.description,
            primaryFieldId: table.primaryFieldId,
            fields: table.fields,
            views: table.views,
          }),
        },
      ],
    };
  } catch (error) {
    console.error('Error reading resource:', error);
    throw error;
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_records',
        description: 'List records from a table',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            maxRecords: { type: 'number', optional: true },
          },
          required: ['baseId', 'tableId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'list_records') {
    // Parse and validate the arguments
    const args = ListRecordsArgsSchema.parse(request.params.arguments);

    try {
      const base = airtable.base(args.baseId);
      const records = await base.table(args.tableId).select({
        maxRecords: args.maxRecords || 100,
      }).firstPage();

      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify(records.map(record => ({
            id: record.id,
            fields: record.fields,
          }))),
        }],
        isError: false,
      };
    } catch (error) {
      console.error('Error listing records:', error);
      throw error;
    }
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
