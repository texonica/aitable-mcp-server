import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
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
 * AITable MCP Server class
 */
export class AITableMCPServer implements IAirtableMCPServer {
  private server: McpServer;
  private aitableService: IAirtableService;

  constructor(aitableService: IAirtableService) {
    this.aitableService = aitableService;
    this.server = new McpServer({
      name: 'AITable',
      version: '0.1.0',
    });
    this.registerTools();
    this.registerResources();
  }

  /**
   * Register all tools with the server
   */
  private registerTools(): void {
    // List bases tool
    this.server.tool(
      'list_bases',
      {},
      async () => {
        const response = await this.aitableService.listBases();
        return {
          content: [{
            type: 'text',
            mimeType: 'application/json',
            text: JSON.stringify(response),
          }],
        };
      }
    );

    // List tables tool
    this.server.tool(
      'list_tables',
      ListTablesArgsSchema.shape,
      async (args) => {
        try {
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
            
            return {
              content: [{
                type: 'text',
                mimeType: 'application/json',
                text: JSON.stringify({ tables }),
              }],
            };
          }
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(baseSchema),
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

    // Describe table tool
    this.server.tool(
      'describe_table',
      DescribeTableArgsSchema.shape,
      async (args) => {
        try {
          const baseSchema = await this.aitableService.getBaseSchema(args.baseId);
          
          const table = baseSchema.tables.find(t => t.id === args.tableId);
          if (!table) {
            return {
              content: [{
                type: 'text',
                mimeType: 'application/json',
                text: JSON.stringify({ error: `Table not found: ${args.tableId}` }),
              }],
              isError: true,
            };
          }
          
          // Apply detail level filtering if specified
          if (args.detailLevel) {
            if (args.detailLevel === 'tableIdentifiersOnly') {
              return {
                content: [{
                  type: 'text',
                  mimeType: 'application/json',
                  text: JSON.stringify({
                    id: table.id,
                    name: table.name,
                  }),
                }],
              };
            } else if (args.detailLevel === 'identifiersOnly') {
              return {
                content: [{
                  type: 'text',
                  mimeType: 'application/json',
                  text: JSON.stringify({
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
                  }),
                }],
              };
            }
          }
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(table),
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

    // List records tool
    this.server.tool(
      'list_records',
      ListRecordsArgsSchema.shape,
      async (args) => {
        try {
          const records = await this.aitableService.listRecords(
            args.baseId,
            args.tableId,
            {
              maxRecords: args.maxRecords,
              filterByFormula: args.filterByFormula,
            }
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ records }),
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

    // Search records tool
    this.server.tool(
      'search_records',
      SearchRecordsArgsSchema.shape,
      async (args) => {
        try {
          const records = await this.aitableService.searchRecords(
            args.baseId,
            args.tableId,
            args.searchTerm,
            args.fieldIds,
            args.maxRecords
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ records }),
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

    // Get record tool
    this.server.tool(
      'get_record',
      GetRecordArgsSchema.shape,
      async (args) => {
        try {
          const record = await this.aitableService.getRecord(
            args.baseId,
            args.tableId,
            args.recordId
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(record),
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

    // Create record tool
    this.server.tool(
      'create_record',
      CreateRecordArgsSchema.shape,
      async (args) => {
        try {
          const record = await this.aitableService.createRecord(
            args.baseId,
            args.tableId,
            args.fields
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(record),
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

    // Update records tool
    this.server.tool(
      'update_records',
      UpdateRecordsArgsSchema.shape,
      async (args) => {
        try {
          const records = await this.aitableService.updateRecords(
            args.baseId,
            args.tableId,
            args.records
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ records }),
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

    // Delete records tool
    this.server.tool(
      'delete_records',
      DeleteRecordsArgsSchema.shape,
      async (args) => {
        try {
          const deletedRecords = await this.aitableService.deleteRecords(
            args.baseId,
            args.tableId,
            args.recordIds
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify({ records: deletedRecords }),
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

    // Create table tool
    this.server.tool(
      'create_table',
      CreateTableArgsSchema.shape,
      async (args) => {
        try {
          const table = await this.aitableService.createTable(
            args.baseId,
            args.name,
            args.fields,
            args.description
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(table),
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

    // Update table tool
    this.server.tool(
      'update_table',
      UpdateTableArgsSchema.shape,
      async (args) => {
        try {
          const table = await this.aitableService.updateTable(
            args.baseId,
            args.tableId,
            {
              name: args.name,
              description: args.description,
            }
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(table),
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

    // Create field tool
    this.server.tool(
      'create_field',
      CreateFieldArgsSchema.shape,
      async (args) => {
        try {
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
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(field),
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

    // Update field tool
    this.server.tool(
      'update_field',
      UpdateFieldArgsSchema.shape,
      async (args) => {
        try {
          const field = await this.aitableService.updateField(
            args.baseId,
            args.tableId,
            args.fieldId,
            {
              name: args.name,
              description: args.description,
            }
          );
          
          return {
            content: [{
              type: 'text',
              mimeType: 'application/json',
              text: JSON.stringify(field),
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
  private registerResources(): void {
    // Register base resource template
    this.server.resource(
      'aitable-base',
      new ResourceTemplate('aitable://{baseId}', { list: undefined }),
      async (uri, { baseId }) => {
        try {
          // Ensure baseId is treated as a string
          const baseIdString = typeof baseId === 'string' ? baseId : 
            Array.isArray(baseId) ? baseId[0] : String(baseId);
          
          const baseSchema = await this.aitableService.getBaseSchema(baseIdString);
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(baseSchema),
            }],
          };
        } catch (error) {
          console.error('Error reading base resource:', error);
          return {
            contents: [],
          };
        }
      }
    );

    // Register table schema resource template
    this.server.resource(
      'aitable-table-schema',
      new ResourceTemplate('aitable://{baseId}/{tableId}/schema', { list: undefined }),
      async (uri, { baseId, tableId }) => {
        try {
          // Ensure baseId is treated as a string
          const baseIdString = typeof baseId === 'string' ? baseId : 
            Array.isArray(baseId) ? baseId[0] : String(baseId);
          
          // Ensure tableId is treated as a string
          const tableIdString = typeof tableId === 'string' ? tableId :
            Array.isArray(tableId) ? tableId[0] : String(tableId);
          
          const baseSchema = await this.aitableService.getBaseSchema(baseIdString);
          const table = baseSchema.tables.find(t => t.id === tableIdString);
          
          if (!table) {
            return {
              contents: [],
            };
          }
          
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(table),
            }],
          };
        } catch (error) {
          console.error('Error reading table schema resource:', error);
          return {
            contents: [],
          };
        }
      }
    );
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
