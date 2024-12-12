#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import Airtable from 'airtable';
import fetch, { RequestInit } from 'node-fetch';
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
  color: z.string().optional(),
  icon: z.string().optional(),
}).passthrough();

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

// Zod schemas for tool arguments
const ListRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  maxRecords: z.number().optional(),
});

const ListTablesArgsSchema = z.object({
  baseId: z.string(),
});

const GetRecordArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  recordId: z.string(),
});

const CreateRecordArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  fields: z.record(z.any()),
});

const UpdateRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  records: z.array(z.object({
    id: z.string(),
    fields: z.record(z.any()),
  })),
});

const DeleteRecordsArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  recordIds: z.array(z.string()),
});

const CreateTableArgsSchema = z.object({
  baseId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    options: FieldOptionsSchema.optional(),
  })),
});

const UpdateTableArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

const CreateFieldArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  options: FieldOptionsSchema.optional(),
});

const UpdateFieldArgsSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  fieldId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

// Helper functions
async function fetchFromAirtableAPI<T>(endpoint: string, schema: z.ZodSchema<T>, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.airtable.com${endpoint}`, {
    ...options,
    headers: { 
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    throw new Error(`Airtable API Error: ${response.statusText}. Response: ${responseText}`);
  }

  try {
    const data = JSON.parse(responseText);
    return schema.parse(data);
  } catch (parseError) {
    throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

function formatToolResponse(data: any, isError = false): CallToolResult {
  return {
    content: [{ 
      type: 'text',
      mimeType: 'application/json',
      text: JSON.stringify(data),
    }],
    isError,
  };
}

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
  return fetchFromAirtableAPI('/v0/meta/bases', ListBasesResponseSchema);
}

async function getBaseSchema(baseId: string) {
  return fetchFromAirtableAPI(`/v0/meta/bases/${baseId}/tables`, BaseSchemaResponseSchema);
}

const SCHEMA_PATH = 'schema';

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const { bases } = await listBases();
  const resources = await Promise.all(bases.map(async (base) => {
    const schema = await getBaseSchema(base.id);
    return schema.tables.map((table) => ({
      uri: `airtable://${base.id}/${table.id}/${SCHEMA_PATH}`,
      mimeType: 'application/json',
      name: `${base.name}: ${table.name} schema`,
    }));
  }));

  return {
    resources: resources.flat(),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/airtable:\/\/([^/]+)\/([^/]+)\/schema/);
  
  if (!match || !match[1] || !match[2]) {
    throw new Error('Invalid resource URI');
  }

  const [, baseId, tableId] = match;
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
      {
        name: 'list_bases',
        description: 'List all accessible Airtable bases',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_tables',
        description: 'List all tables in a specific base',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
          },
          required: ['baseId'],
        },
      },
      {
        name: 'get_record',
        description: 'Get a specific record by ID',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            recordId: { type: 'string' },
          },
          required: ['baseId', 'tableId', 'recordId'],
        },
      },
      {
        name: 'create_record',
        description: 'Create a new record in a table',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            fields: { type: 'object' },
          },
          required: ['baseId', 'tableId', 'fields'],
        },
      },
      {
        name: 'update_records',
        description: 'Update one or more records in a table',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            records: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  fields: { type: 'object' },
                },
                required: ['id', 'fields'],
              },
            },
          },
          required: ['baseId', 'tableId', 'records'],
        },
      },
      {
        name: 'delete_records',
        description: 'Delete one or more records from a table',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            recordIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['baseId', 'tableId', 'recordIds'],
        },
      },
      {
        name: 'create_table',
        description: 'Create a new table in a base',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', optional: true },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  description: { type: 'string', optional: true },
                  options: { type: 'object', optional: true },
                },
                required: ['name', 'type'],
              },
            },
          },
          required: ['baseId', 'name', 'fields'],
        },
      },
      {
        name: 'update_table',
        description: 'Update a table\'s name or description',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            name: { type: 'string', optional: true },
            description: { type: 'string', optional: true },
          },
          required: ['baseId', 'tableId'],
        },
      },
      {
        name: 'create_field',
        description: 'Create a new field in a table',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string' },
            description: { type: 'string', optional: true },
            options: { type: 'object', optional: true },
          },
          required: ['baseId', 'tableId', 'name', 'type'],
        },
      },
      {
        name: 'update_field',
        description: 'Update a field\'s name or description',
        inputSchema: {
          type: 'object',
          properties: {
            baseId: { type: 'string' },
            tableId: { type: 'string' },
            fieldId: { type: 'string' },
            name: { type: 'string', optional: true },
            description: { type: 'string', optional: true },
          },
          required: ['baseId', 'tableId', 'fieldId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case 'list_records': {
        const args = ListRecordsArgsSchema.parse(request.params.arguments);
        const base = airtable.base(args.baseId);
        const records = await base.table(args.tableId).select(
          args.maxRecords !== undefined
            ? { maxRecords: args.maxRecords }
            : {}
        ).firstPage();

        return formatToolResponse(records.map(record => ({
          id: record.id,
          fields: record.fields,
        })));
      }

      case 'list_bases': {
        const { bases } = await listBases();
        return formatToolResponse(bases.map(base => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel,
        })));
      }

      case 'list_tables': {
        const args = ListTablesArgsSchema.parse(request.params.arguments);
        const schema = await getBaseSchema(args.baseId);
        return formatToolResponse(schema.tables.map(table => ({
          id: table.id,
          name: table.name,
          description: table.description,
          fields: table.fields,
          views: table.views,
        })));
      }

      case 'get_record': {
        const args = GetRecordArgsSchema.parse(request.params.arguments);
        const base = airtable.base(args.baseId);
        const record = await base.table(args.tableId).find(args.recordId);
        
        return formatToolResponse({
          id: record.id,
          fields: record.fields,
        });
      }

      case 'create_record': {
        const args = CreateRecordArgsSchema.parse(request.params.arguments);
        const base = airtable.base(args.baseId);
        const record = await base.table(args.tableId).create(args.fields);
        
        return formatToolResponse({
          id: record.id,
          fields: record.fields,
        });
      }

      case 'update_records': {
        const args = UpdateRecordsArgsSchema.parse(request.params.arguments);
        const base = airtable.base(args.baseId);
        const records = await base.table(args.tableId).update(
          args.records.map(record => ({
            id: record.id,
            fields: record.fields,
          }))
        );
        
        return formatToolResponse(records.map(record => ({
          id: record.id,
          fields: record.fields,
        })));
      }

      case 'delete_records': {
        const args = DeleteRecordsArgsSchema.parse(request.params.arguments);
        const base = airtable.base(args.baseId);
        const records = await base.table(args.tableId).destroy(args.recordIds);
        
        return formatToolResponse(records.map(record => ({
          id: record.id,
        })));
      }

      case 'create_table': {
        const args = CreateTableArgsSchema.parse(request.params.arguments);
        const response = await fetchFromAirtableAPI(
          `/v0/meta/bases/${args.baseId}/tables`,
          TableSchema,
          {
            method: 'POST',
            body: JSON.stringify({
              name: args.name,
              description: args.description,
              fields: args.fields,
            }),
          }
        );
        
        return formatToolResponse(response);
      }

      case 'update_table': {
        const args = UpdateTableArgsSchema.parse(request.params.arguments);
        const response = await fetchFromAirtableAPI(
          `/v0/meta/bases/${args.baseId}/tables/${args.tableId}`,
          TableSchema,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: args.name,
              description: args.description,
            }),
          }
        );
        
        return formatToolResponse(response);
      }

      case 'create_field': {
        const args = CreateFieldArgsSchema.parse(request.params.arguments);
        const response = await fetchFromAirtableAPI(
          `/v0/meta/bases/${args.baseId}/tables/${args.tableId}/fields`,
          FieldSchema,
          {
            method: 'POST',
            body: JSON.stringify({
              name: args.name,
              type: args.type,
              description: args.description,
              options: args.options,
            }),
          }
        );
        
        return formatToolResponse(response);
      }

      case 'update_field': {
        const args = UpdateFieldArgsSchema.parse(request.params.arguments);
        const response = await fetchFromAirtableAPI(
          `/v0/meta/bases/${args.baseId}/tables/${args.tableId}/fields/${args.fieldId}`,
          FieldSchema,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: args.name,
              description: args.description,
            }),
          }
        );
        
        return formatToolResponse(response);
      }

      default: {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }
    }
  } catch (error) {
    return formatToolResponse(`Error in tool ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`, true);
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
