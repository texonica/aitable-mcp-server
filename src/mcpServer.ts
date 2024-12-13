import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolResult,
  ListToolsResult,
  ReadResourceResult,
  ListResourcesResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ListRecordsArgsSchema,
  ListTablesArgsSchema,
  GetRecordArgsSchema,
  CreateRecordArgsSchema,
  UpdateRecordsArgsSchema,
  DeleteRecordsArgsSchema,
  CreateTableArgsSchema,
  UpdateTableArgsSchema,
  CreateFieldArgsSchema,
  UpdateFieldArgsSchema,
  IAirtableService,
  IAirtableMCPServer,
} from './types.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export class AirtableMCPServer implements IAirtableMCPServer {
  private server: Server;
  private airtableService: IAirtableService;
  private readonly SCHEMA_PATH = 'schema';

  constructor(airtableService: IAirtableService) {
    this.airtableService = airtableService;
    this.server = new Server(
      {
        name: 'airtable-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    this.initializeHandlers();
  }

  private formatToolResponse(data: any, isError = false): CallToolResult {
    return {
      content: [{ 
        type: 'text',
        mimeType: 'application/json',
        text: JSON.stringify(data),
      }],
      isError,
    };
  }

  private initializeHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, this.handleListResources.bind(this));
    this.server.setRequestHandler(ReadResourceRequestSchema, this.handleReadResource.bind(this));
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
  }

  private async handleListResources(request: z.infer<typeof ListResourcesRequestSchema>): Promise<ListResourcesResult> {
    const { bases } = await this.airtableService.listBases();
    const resources = await Promise.all(bases.map(async (base) => {
      const schema = await this.airtableService.getBaseSchema(base.id);
      return schema.tables.map((table) => ({
        uri: `airtable://${base.id}/${table.id}/${this.SCHEMA_PATH}`,
        mimeType: 'application/json',
        name: `${base.name}: ${table.name} schema`,
      }));
    }));

    return {
      resources: resources.flat(),
    };
  }

  private async handleReadResource(request: z.infer<typeof ReadResourceRequestSchema>): Promise<ReadResourceResult> {
    const uri = request.params.uri;
    const match = uri.match(/^airtable:\/\/([^/]+)\/([^/]+)\/schema$/);
    
    if (!match || !match[1] || !match[2]) {
      throw new Error('Invalid resource URI');
    }

    const [, baseId, tableId] = match;
    const schema = await this.airtableService.getBaseSchema(baseId);
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
  }

  private getInputSchema(schema: z.ZodType<object>): ListToolsResult['tools'][0]['inputSchema'] {
    const jsonSchema = zodToJsonSchema(schema);
    if (!('type' in jsonSchema) || jsonSchema.type !== 'object') {
      throw new Error(`Invalid input schema to convert in airtable-mcp-server: expected an object but got ${'type' in jsonSchema ? jsonSchema.type : 'no type'}`);
    }
    return { ...jsonSchema, type: 'object' };
  }

  private async handleListTools(): Promise<ListToolsResult> {
    return {
      tools: [
        {
          name: 'list_records',
          description: 'List records from a table',
          inputSchema: this.getInputSchema(ListRecordsArgsSchema),
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
          inputSchema: this.getInputSchema(ListTablesArgsSchema),
        },
        {
          name: 'get_record',
          description: 'Get a specific record by ID',
          inputSchema: this.getInputSchema(GetRecordArgsSchema),
        },
        {
          name: 'create_record',
          description: 'Create a new record in a table',
          inputSchema: this.getInputSchema(CreateRecordArgsSchema),
        },
        {
          name: 'update_records',
          description: 'Update one or more records in a table',
          inputSchema: this.getInputSchema(UpdateRecordsArgsSchema),
        },
        {
          name: 'delete_records',
          description: 'Delete one or more records from a table',
          inputSchema: this.getInputSchema(DeleteRecordsArgsSchema),
        },
        {
          name: 'create_table',
          description: 'Create a new table in a base',
          inputSchema: this.getInputSchema(CreateTableArgsSchema),
        },
        {
          name: 'update_table',
          description: 'Update a table\'s name or description',
          inputSchema: this.getInputSchema(UpdateTableArgsSchema),
        },
        {
          name: 'create_field',
          description: 'Create a new field in a table',
          inputSchema: this.getInputSchema(CreateFieldArgsSchema),
        },
        {
          name: 'update_field',
          description: 'Update a field\'s name or description',
          inputSchema: this.getInputSchema(UpdateFieldArgsSchema),
        },
      ],
    };
  }

  private async handleCallTool(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'list_records': {
          const args = ListRecordsArgsSchema.parse(request.params.arguments);
          const records = await this.airtableService.listRecords(
            args.baseId,
            args.tableId,
            { maxRecords: args.maxRecords },
          );
          return this.formatToolResponse(records);
        }

        case 'list_bases': {
          const { bases } = await this.airtableService.listBases();
          return this.formatToolResponse(bases.map(base => ({
            id: base.id,
            name: base.name,
            permissionLevel: base.permissionLevel,
          })));
        }

        case 'list_tables': {
          const args = ListTablesArgsSchema.parse(request.params.arguments);
          const schema = await this.airtableService.getBaseSchema(args.baseId);
          return this.formatToolResponse(schema.tables.map(table => ({
            id: table.id,
            name: table.name,
            description: table.description,
            fields: table.fields,
            views: table.views,
          })));
        }

        case 'get_record': {
          const args = GetRecordArgsSchema.parse(request.params.arguments);
          const record = await this.airtableService.getRecord(args.baseId, args.tableId, args.recordId);
          return this.formatToolResponse({
            id: record.id,
            fields: record.fields,
          });
        }

        case 'create_record': {
          const args = CreateRecordArgsSchema.parse(request.params.arguments);
          const record = await this.airtableService.createRecord(args.baseId, args.tableId, args.fields);
          return this.formatToolResponse({
            id: record.id,
            fields: record.fields,
          });
        }

        case 'update_records': {
          const args = UpdateRecordsArgsSchema.parse(request.params.arguments);
          const records = await this.airtableService.updateRecords(args.baseId, args.tableId, args.records);
          return this.formatToolResponse(records.map(record => ({
            id: record.id,
            fields: record.fields,
          })));
        }

        case 'delete_records': {
          const args = DeleteRecordsArgsSchema.parse(request.params.arguments);
          const records = await this.airtableService.deleteRecords(args.baseId, args.tableId, args.recordIds);
          return this.formatToolResponse(records.map(record => ({
            id: record.id,
          })));
        }

        case 'create_table': {
          const args = CreateTableArgsSchema.parse(request.params.arguments);
          const table = await this.airtableService.createTable(
            args.baseId,
            args.name,
            args.fields,
            args.description
          );
          return this.formatToolResponse(table);
        }

        case 'update_table': {
          const args = UpdateTableArgsSchema.parse(request.params.arguments);
          const table = await this.airtableService.updateTable(
            args.baseId,
            args.tableId,
            { name: args.name, description: args.description }
          );
          return this.formatToolResponse(table);
        }

        case 'create_field': {
          const args = CreateFieldArgsSchema.parse(request.params.arguments);
          const field = await this.airtableService.createField(
            args.baseId,
            args.tableId,
            args.field
          );
          return this.formatToolResponse(field);
        }

        case 'update_field': {
          const args = UpdateFieldArgsSchema.parse(request.params.arguments);
          const field = await this.airtableService.updateField(
            args.baseId,
            args.tableId,
            args.fieldId,
            {
              name: args.name,
              description: args.description,
            }
          );
          return this.formatToolResponse(field);
        }

        default: {
          throw new Error(`Unknown tool: ${request.params.name}`);
        }
      }
    } catch (error) {
      return this.formatToolResponse(
        `Error in tool ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
