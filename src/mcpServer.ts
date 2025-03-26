import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  IAITableService,
  IAITableMCPServer,
  Base,
  Table,
  Field,
  TableSchema,
} from './types.js';
import { AITableService } from "./aitableService.js";

/**
 * AITable MCP Server class
 */
export class AITableMCPServer extends McpServer implements IAITableMCPServer {
  private aitableService: AITableService;

  constructor(aitableService: AITableService) {
    super({
      name: 'AITable MCP Server',
      version: '1.0.0',
    });
    this.aitableService = aitableService;
    this.setupTools();
    this.setupResources();
  }

  private async executeToolByName(name: string, input: any): Promise<any> {
    console.error(`[TOOL] Executing tool ${name} with input:`, input);
    
    try {
      // Use type casting to access private properties
      const registeredTools = (this as any)._registeredTools;
      
      if (!registeredTools || !registeredTools[name]) {
        throw new Error(`Tool ${name} not found`);
      }

      // Execute the tool with the input
      const result = await registeredTools[name].cb(input, {});
      console.error(`[TOOL] Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[ERROR] Failed to execute tool ${name}:`, error);
      throw error;
    }
  }

  setupTools(): void {
    // List bases
    this.tool(
      'list_bases',
      'List all available AITable bases',
      {},
      async (_args: {}, _extra: RequestHandlerExtra) => {
        const bases = await this.aitableService.listBases();
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ bases }),
          }],
        };
      }
    );

    // Get base schema
    this.tool(
      'get_base_schema',
      'Get schema information for a base',
      {
        baseId: z.string().describe('ID of the AITable base'),
      },
      async (args: { baseId: string }, _extra: RequestHandlerExtra) => {
        try {
          // First get standard schema
          const schema = await this.aitableService.getBaseSchema(args.baseId);
          
          // Then get all datasheets including those in subfolders
          try {
            const allDatasheets = await this.aitableService.getAllDatasheets(args.baseId);
            
            // Add path information to each table if it matches a datasheet
            schema.tables = schema.tables.map(table => {
              const matchingDatasheet = allDatasheets.find(ds => ds.id === table.id);
              if (matchingDatasheet) {
                return {
                  ...table,
                  path: matchingDatasheet.path
                };
              }
              return table;
            });
            
            // Add any datasheets that weren't in the original tables list
            const existingTableIds = new Set(schema.tables.map(t => t.id));
            const additionalDatasheets = allDatasheets
              .filter(ds => !existingTableIds.has(ds.id))
              .map(ds => ({
                id: ds.id,
                name: ds.name,
                path: ds.path,
                description: '',
                primaryFieldId: '', // This will be populated later if needed
                fields: [],
                views: []
              }));
            
            schema.tables = [...schema.tables, ...additionalDatasheets];
            console.log(`Enhanced schema now has ${schema.tables.length} tables (added ${additionalDatasheets.length} from subfolders)`);
          } catch (error) {
            // If getAllDatasheets fails, just return the original schema
            console.error('Failed to get all datasheets:', error);
          }
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(schema),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            }],
            isError: true,
          };
        }
      }
    );

    // List records
    this.tool(
      'list_records',
      'List records in a table',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        maxRecords: z.number().optional().describe('Maximum number of records to return'),
        filterByFormula: z.string().optional().describe('Filter formula for records'),
      },
      async (args: { baseId: string; tableId: string; maxRecords?: number; filterByFormula?: string }, _extra: RequestHandlerExtra) => {
        const records = await this.aitableService.listRecords(args.baseId, args.tableId, {
          maxRecords: args.maxRecords,
          filterByFormula: args.filterByFormula,
        });
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ records }),
          }],
        };
      }
    );

    // Get record
    this.tool(
      'get_record',
      'Get a specific record by ID',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        recordId: z.string().describe('ID of the record'),
      },
      async (args: { baseId: string; tableId: string; recordId: string }, _extra: RequestHandlerExtra) => {
        const record = await this.aitableService.getRecord(args.baseId, args.tableId, args.recordId);
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ record }),
          }],
        };
      }
    );

    // Create record
    this.tool(
      'create_record',
      'Create a new record in a table',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        fields: z.record(z.string(), z.any()).describe('Fields and values for the new record'),
      },
      async (args: { baseId: string; tableId: string; fields: Record<string, any> }, _extra: RequestHandlerExtra) => {
        const record = await this.aitableService.createRecord(args.baseId, args.tableId, args.fields);
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ record }),
          }],
        };
      }
    );

    // Update records
    this.tool(
      'update_records',
      'Update multiple records in a table',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        records: z.array(z.object({
          id: z.string(),
          fields: z.record(z.string(), z.any()),
        })).describe('Array of records to update'),
      },
      async (args: { baseId: string; tableId: string; records: Array<{ id: string; fields: Record<string, any> }> }, _extra: RequestHandlerExtra) => {
        const records = await this.aitableService.updateRecords(args.baseId, args.tableId, args.records);
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ records }),
          }],
        };
      }
    );

    // Delete records
    this.tool(
      'delete_records',
      'Delete multiple records from a table',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        recordIds: z.array(z.string()).describe('Array of record IDs to delete'),
      },
      async (args: { baseId: string; tableId: string; recordIds: string[] }, _extra: RequestHandlerExtra) => {
        const result = await this.aitableService.deleteRecords(args.baseId, args.tableId, args.recordIds);
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ result }),
          }],
        };
      }
    );

    // Create table
    this.tool(
      'create_table',
      'Create a new table in a base',
      {
        baseId: z.string().describe('ID of the AITable base'),
        name: z.string().describe('Name of the new table'),
        description: z.string().optional().describe('Description of the table'),
        fields: z.array(z.object({
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
          options: z.record(z.string(), z.any()).optional(),
        })).describe('Array of field definitions'),
      },
      async (args: {
        baseId: string;
        name: string;
        description?: string;
        fields: Array<{
          name: string;
          type: string;
          description?: string;
          options?: Record<string, any>;
        }>;
      }, _extra: RequestHandlerExtra) => {
        const table = await this.aitableService.createTable(args.baseId, args.name, args.fields, args.description);
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ table }),
          }],
        };
      }
    );

    // Update table
    this.tool(
      'update_table',
      'Update a table in a base',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        name: z.string().optional().describe('New name for the table'),
        description: z.string().optional().describe('New description for the table'),
      },
      async (args: { baseId: string; tableId: string; name?: string; description?: string }, _extra: RequestHandlerExtra) => {
        const table = await this.aitableService.updateTable(args.baseId, args.tableId, {
          name: args.name,
          description: args.description,
        });
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ table }),
          }],
        };
      }
    );

    // Create field
    this.tool(
      'create_field',
      'Create a new field in a table',
      {
        baseId: z.string().describe('ID of the AITable base'),
        tableId: z.string().describe('ID of the table'),
        name: z.string().describe('Name of the new field'),
        type: z.string().describe('Type of the field'),
        description: z.string().optional().describe('Description of the field'),
        options: z.record(z.string(), z.any()).optional().describe('Additional options for the field'),
      },
      async (args: {
        baseId: string;
        tableId: string;
        name: string;
        type: string;
        description?: string;
        options?: Record<string, any>;
      }, _extra: RequestHandlerExtra) => {
        const field = await this.aitableService.createField(args.baseId, args.tableId, {
          name: args.name,
          type: args.type,
          description: args.description,
          options: args.options,
        });
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify({ field }),
          }],
        };
      }
    );

    // List all datasheets tool (including those in subfolders)
    this.tool(
      'list_all_datasheets',
      'List all datasheets in a space, including those in subfolders',
      {
        spaceId: z.string().describe('ID of the AITable space to search for datasheets'),
      },
      async (args: { spaceId: string }, _extra: RequestHandlerExtra) => {
        try {
          const datasheets = await this.aitableService.getAllDatasheets(args.spaceId);
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ datasheets }),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Register all resources with the server
   */
  setupResources(): void {
    // Base schema resource
    this.resource(
      'base',
      new ResourceTemplate('base://{baseId}', { list: undefined }),
      async (uri, variables: Variables) => {
        const baseId = String(variables.baseId);
        const schema = await this.aitableService.getBaseSchema(baseId);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(schema),
          }],
        };
      }
    );

    // Table records resource
    this.resource(
      'table',
      new ResourceTemplate('table://{baseId}/{tableId}', { list: undefined }),
      async (uri, variables: Variables) => {
        const baseId = String(variables.baseId);
        const tableId = String(variables.tableId);
        const records = await this.aitableService.listRecords(baseId, tableId);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ records }),
          }],
        };
      }
    );
  }

  /**
   * Connect the server to a transport
   */
  async connect(transport: Transport): Promise<void> {
    console.error('[CONNECT] Connecting AITableMCPServer to transport');
    await super.connect(transport);
    console.error('[CONNECT] Connected AITableMCPServer to transport');
  }

  /**
   * Close the server connection
   */
  async close(): Promise<void> {
    console.error('[CLOSE] Closing AITableMCPServer');
    await super.close();
    console.error('[CLOSE] Closed AITableMCPServer');
  }

  public async executeToolDirectly(name: string, input: any): Promise<any> {
    console.error(`[TOOL] Executing tool ${name} with input:`, input);
    
    try {
      const result = await this.executeToolByName(name, input);
      console.error(`[TOOL] Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[ERROR] Failed to execute tool ${name}:`, error);
      throw error;
    }
  }
}
