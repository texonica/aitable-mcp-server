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
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  IAirtableService,
  IAirtableMCPServer,
} from './types.js';
import {
  ListRecordsArgsSchema,
  ListTablesArgsSchema,
  DescribeTableArgsSchema,
  GetRecordArgsSchema,
  CreateRecordArgsSchema,
  UpdateRecordsArgsSchema,
  DeleteRecordsArgsSchema,
  CreateTableArgsSchema,
  UpdateTableArgsSchema,
  CreateFieldArgsSchema,
  UpdateFieldArgsSchema,
  SearchRecordsArgsSchema,
} from './types.js';

/**
 * Convert a Zod schema to JSON Schema for MCP tools
 */
const getInputSchema = (schema: z.ZodType<object>): ListToolsResult['tools'][0]['inputSchema'] => {
  const jsonSchema = zodToJsonSchema(schema);
  if (!('type' in jsonSchema) || jsonSchema.type !== 'object') {
    throw new Error(`Invalid input schema to convert in aitable-mcp-server: expected an object but got ${'type' in jsonSchema ? jsonSchema.type : 'no type'}`);
  }
  return { ...jsonSchema, type: 'object' };
};

/**
 * Format the response for MCP tool calls
 */
const formatToolResponse = (data: unknown, isError = false): CallToolResult => {
  return {
    content: [{
      type: 'text',
      mimeType: 'application/json',
      text: JSON.stringify(data),
    }],
    isError,
  };
};

/**
 * AITable MCP Server class
 */
export class AITableMCPServer implements IAirtableMCPServer {
  private server: Server;
  private aitableService: IAirtableService;
  private readonly SCHEMA_PATH = 'schema';

  constructor(aitableService: IAirtableService) {
    this.aitableService = aitableService;
    this.server = new Server();
    this.initializeHandlers();
  }

  /**
   * Initialize the handlers for MCP requests
   */
  private initializeHandlers(): void {
    this.server.registerListResourcesHandler(this.handleListResources.bind(this));
    this.server.registerReadResourceHandler(this.handleReadResource.bind(this));
    this.server.registerListToolsHandler(this.handleListTools.bind(this));
    this.server.registerCallToolHandler(this.handleCallTool.bind(this));
  }

  /**
   * Handle listing resources (bases and tables)
   */
  private async handleListResources(): Promise<ListResourcesResult> {
    try {
      const bases = await this.aitableService.listBases();
      
      return {
        resources: bases.bases.flatMap(base => [
          { name: `aitable://${base.id}` },
        ]),
      };
    } catch (error) {
      console.error('Error listing resources:', error);
      return { resources: [] };
    }
  }

  /**
   * Handle reading a resource (getting schema for a table)
   */
  private async handleReadResource(request: z.infer<typeof ReadResourceRequestSchema>): Promise<ReadResourceResult> {
    try {
      const resourcePathParts = request.resourceName.split('/');
      
      // Resource path should be in the format "aitable://{baseId}/{tableId}/schema"
      if (resourcePathParts.length < 3 || !resourcePathParts[0].startsWith('aitable://')) {
        return {
          content: [],
          isError: true,
        };
      }

      const baseId = resourcePathParts[0].replace('aitable://', '');
      const isBaseRequest = resourcePathParts.length === 1;
      
      if (isBaseRequest) {
        // This is a request for a base, get all the tables
        const baseSchema = await this.aitableService.getBaseSchema(baseId);
        
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify(baseSchema),
          }],
          isError: false,
        };
      }

      const tableId = resourcePathParts[1];
      const isSchemaRequest = resourcePathParts[2] === this.SCHEMA_PATH;
      
      if (isSchemaRequest) {
        // This is a request for a table schema
        const baseSchema = await this.aitableService.getBaseSchema(baseId);
        const table = baseSchema.tables.find(t => t.id === tableId);
        
        if (!table) {
          return {
            content: [],
            isError: true,
          };
        }
        
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify(table),
          }],
          isError: false,
        };
      }
      
      return {
        content: [],
        isError: true,
      };
    } catch (error) {
      console.error('Error reading resource:', error);
      return {
        content: [],
        isError: true,
      };
    }
  }

  /**
   * Handle listing available tools
   */
  private async handleListTools(): Promise<ListToolsResult> {
    return {
      tools: [
        {
          name: 'list_bases',
          description: 'List all accessible AITable bases',
          inputSchema: getInputSchema(z.object({})),
        },
        {
          name: 'list_tables',
          description: 'List all tables in a specific base',
          inputSchema: getInputSchema(ListTablesArgsSchema),
        },
        {
          name: 'describe_table',
          description: 'Get detailed information about a specific table',
          inputSchema: getInputSchema(DescribeTableArgsSchema),
        },
        {
          name: 'list_records',
          description: 'List records from a specified AITable table',
          inputSchema: getInputSchema(ListRecordsArgsSchema),
        },
        {
          name: 'search_records',
          description: 'Search for records containing specific text',
          inputSchema: getInputSchema(SearchRecordsArgsSchema),
        },
        {
          name: 'get_record',
          description: 'Get a specific record by ID',
          inputSchema: getInputSchema(GetRecordArgsSchema),
        },
        {
          name: 'create_record',
          description: 'Create a new record in a table',
          inputSchema: getInputSchema(CreateRecordArgsSchema),
        },
        {
          name: 'update_records',
          description: 'Update one or more records in a table',
          inputSchema: getInputSchema(UpdateRecordsArgsSchema),
        },
        {
          name: 'delete_records',
          description: 'Delete one or more records from a table',
          inputSchema: getInputSchema(DeleteRecordsArgsSchema),
        },
        {
          name: 'create_table',
          description: 'Create a new table in a base',
          inputSchema: getInputSchema(CreateTableArgsSchema),
        },
        {
          name: 'update_table',
          description: 'Update a table\'s name or description',
          inputSchema: getInputSchema(UpdateTableArgsSchema),
        },
        {
          name: 'create_field',
          description: 'Create a new field in a table',
          inputSchema: getInputSchema(CreateFieldArgsSchema),
        },
        {
          name: 'update_field',
          description: 'Update a field\'s name or description',
          inputSchema: getInputSchema(UpdateFieldArgsSchema),
        },
      ],
    };
  }

  /**
   * Handle tool calls
   */
  private async handleCallTool(request: z.infer<typeof CallToolRequestSchema>): Promise<CallToolResult> {
    const { name, parameters } = request;
    
    try {
      switch (name) {
        case 'list_bases':
          return this.handleListBases();
          
        case 'list_tables':
          return this.handleListTables(parameters);
          
        case 'describe_table':
          return this.handleDescribeTable(parameters);
          
        case 'list_records':
          return this.handleListRecords(parameters);
          
        case 'search_records':
          return this.handleSearchRecords(parameters);
          
        case 'get_record':
          return this.handleGetRecord(parameters);
          
        case 'create_record':
          return this.handleCreateRecord(parameters);
          
        case 'update_records':
          return this.handleUpdateRecords(parameters);
          
        case 'delete_records':
          return this.handleDeleteRecords(parameters);
          
        case 'create_table':
          return this.handleCreateTable(parameters);
          
        case 'update_table':
          return this.handleUpdateTable(parameters);
          
        case 'create_field':
          return this.handleCreateField(parameters);
          
        case 'update_field':
          return this.handleUpdateField(parameters);
          
        default:
          return formatToolResponse({ error: `Unknown tool: ${name}` }, true);
      }
    } catch (error) {
      console.error(`Error handling tool call ${name}:`, error);
      return formatToolResponse({ 
        error: error instanceof Error ? error.message : String(error)
      }, true);
    }
  }

  /**
   * Handle list_bases tool
   */
  private async handleListBases(): Promise<CallToolResult> {
    const response = await this.aitableService.listBases();
    return formatToolResponse(response);
  }

  /**
   * Handle list_tables tool
   */
  private async handleListTables(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = ListTablesArgsSchema.parse(parameters);
    const baseSchema = await this.aitableService.getBaseSchema(args.baseId);
    
    // Apply detail level filtering if specified
    if (args.detailLevel) {
      const tables = baseSchema.tables.map(table => {
        if (args.detailLevel === 'tableIdentifiersOnly') {
          return {
            id: table.id,
            name: table.name,
          };
        } else if (args.detailLevel === 'identifiersOnly') {
          return {
            id: table.id,
            name: table.name,
            fields: table.fields.map(field => ({
              id: field.id,
              name: field.name,
            })),
            views: table.views.map(view => ({
              id: view.id,
              name: view.name,
            })),
          };
        }
        
        return table;
      });
      
      return formatToolResponse({ tables });
    }
    
    return formatToolResponse(baseSchema);
  }

  /**
   * Handle describe_table tool
   */
  private async handleDescribeTable(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = DescribeTableArgsSchema.parse(parameters);
    const baseSchema = await this.aitableService.getBaseSchema(args.baseId);
    
    const table = baseSchema.tables.find(t => t.id === args.tableId);
    if (!table) {
      return formatToolResponse({ error: `Table not found: ${args.tableId}` }, true);
    }
    
    // Apply detail level filtering if specified
    if (args.detailLevel) {
      if (args.detailLevel === 'tableIdentifiersOnly') {
        return formatToolResponse({
          id: table.id,
          name: table.name,
        });
      } else if (args.detailLevel === 'identifiersOnly') {
        return formatToolResponse({
          id: table.id,
          name: table.name,
          fields: table.fields.map(field => ({
            id: field.id,
            name: field.name,
          })),
          views: table.views.map(view => ({
            id: view.id,
            name: view.name,
          })),
        });
      }
    }
    
    return formatToolResponse(table);
  }

  /**
   * Handle list_records tool
   */
  private async handleListRecords(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = ListRecordsArgsSchema.parse(parameters);
    const records = await this.aitableService.listRecords(
      args.baseId,
      args.tableId,
      {
        maxRecords: args.maxRecords,
        filterByFormula: args.filterByFormula,
      }
    );
    
    return formatToolResponse({ records });
  }

  /**
   * Handle search_records tool
   */
  private async handleSearchRecords(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = SearchRecordsArgsSchema.parse(parameters);
    const records = await this.aitableService.searchRecords(
      args.baseId,
      args.tableId,
      args.searchTerm,
      args.fieldIds,
      args.maxRecords
    );
    
    return formatToolResponse({ records });
  }

  /**
   * Handle get_record tool
   */
  private async handleGetRecord(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = GetRecordArgsSchema.parse(parameters);
    const record = await this.aitableService.getRecord(
      args.baseId,
      args.tableId,
      args.recordId
    );
    
    return formatToolResponse(record);
  }

  /**
   * Handle create_record tool
   */
  private async handleCreateRecord(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = CreateRecordArgsSchema.parse(parameters);
    const record = await this.aitableService.createRecord(
      args.baseId,
      args.tableId,
      args.fields
    );
    
    return formatToolResponse(record);
  }

  /**
   * Handle update_records tool
   */
  private async handleUpdateRecords(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = UpdateRecordsArgsSchema.parse(parameters);
    const records = await this.aitableService.updateRecords(
      args.baseId,
      args.tableId,
      args.records
    );
    
    return formatToolResponse({ records });
  }

  /**
   * Handle delete_records tool
   */
  private async handleDeleteRecords(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = DeleteRecordsArgsSchema.parse(parameters);
    const deletedRecords = await this.aitableService.deleteRecords(
      args.baseId,
      args.tableId,
      args.recordIds
    );
    
    return formatToolResponse({ records: deletedRecords });
  }

  /**
   * Handle create_table tool
   */
  private async handleCreateTable(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = CreateTableArgsSchema.parse(parameters);
    const table = await this.aitableService.createTable(
      args.baseId,
      args.name,
      args.fields,
      args.description
    );
    
    return formatToolResponse(table);
  }

  /**
   * Handle update_table tool
   */
  private async handleUpdateTable(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = UpdateTableArgsSchema.parse(parameters);
    const table = await this.aitableService.updateTable(
      args.baseId,
      args.tableId,
      {
        name: args.name,
        description: args.description,
      }
    );
    
    return formatToolResponse(table);
  }

  /**
   * Handle create_field tool
   */
  private async handleCreateField(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = CreateFieldArgsSchema.parse(parameters);
    const field = await this.aitableService.createField(
      args.baseId,
      args.tableId,
      {
        name: args.name,
        type: args.type,
        description: args.description,
        options: args.options,
      }
    );
    
    return formatToolResponse(field);
  }

  /**
   * Handle update_field tool
   */
  private async handleUpdateField(parameters: Record<string, unknown>): Promise<CallToolResult> {
    const args = UpdateFieldArgsSchema.parse(parameters);
    const field = await this.aitableService.updateField(
      args.baseId,
      args.tableId,
      args.fieldId,
      {
        name: args.name,
        description: args.description,
      }
    );
    
    return formatToolResponse(field);
  }

  /**
   * Connect the server to a transport
   */
  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  /**
   * Close the server connection
   */
  async close(): Promise<void> {
    await this.server.close();
  }
}
