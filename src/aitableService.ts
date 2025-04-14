import nodeFetch, { RequestInit } from 'node-fetch';
import { z } from 'zod';
import type {
  IAITableService,
  ListBasesResponse,
  BaseSchemaResponse,
  ListRecordsOptions,
  Field,
  Table,
  AITableRecord,
  FieldSet,
  DatasheetInfo
} from './types.js';
import {
  ListBasesResponseSchema,
  BaseSchemaResponseSchema
} from './types.js';

// Define the fetch function type
type FetchFunction = typeof nodeFetch;

/**
 * Service for interacting with the AITable API
 */
export class AITableService implements IAITableService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchFunction;

  /**
   * Creates a new AITableService instance
   * @param apiKey APITable API key
   * @param baseUrl Base URL for the API
   * @param fetch Fetch implementation to use for requests (node-fetch or browser fetch)
   */
  constructor(
    apiKey: string = process.env.AITABLE_API_KEY || '',
    baseUrl: string = 'https://aitable.ai/fusion/v1',
    fetch: FetchFunction = nodeFetch
  ) {
    if (!apiKey) {
      throw new Error('aitable-mcp-server: No API key provided. Set it in the `AITABLE_API_KEY` environment variable');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetch = fetch;
  }

  /**
   * Helper method to make API requests and validate responses
   */
  private async fetchFromAPI<T>(endpoint: string, schema: z.ZodSchema<T>, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await this.fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'aitable-mcp-server/0.1.0',
          ...options.headers,
        },
      });
      
      // Check for HTML response which indicates authentication issues
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        const responseText = await response.text();
        console.error('Received HTML response instead of JSON');
        throw new Error(`aitable-mcp-server: Received HTML response instead of JSON. The API key may be invalid or the endpoint requires authentication. Status: ${response.status}`);
      }

      const responseText = await response.text();
      
      let responseJson;

      try {
        responseJson = JSON.parse(responseText);
      } catch (error) {
        console.error(`Failed to parse JSON from response`);
        throw new Error(`aitable-mcp-server: Failed to parse JSON response. Status: ${response.status}, Content-Type: ${contentType}`);
      }

      if (!response.ok) {
        throw new Error(`aitable-mcp-server: API request failed: ${JSON.stringify(responseJson)}`);
      }

      try {
        return schema.parse(responseJson);
      } catch (error) {
        console.error('Response validation failed');
        throw new Error(`aitable-mcp-server: API response validation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      console.error('Error in fetchFromAPI:', error);
      throw error;
    }
  }

  /**
   * List all available AITable spaces
   */
  async listBases(): Promise<ListBasesResponse> {
    try {
      // Try AITable API endpoint
      return await this.fetchFromAPI(
        '/v0/meta/bases',
        ListBasesResponseSchema
      );
    } catch (error) {
      // If that fails, try alternative AITable API
      const response = await this.fetchFromAPI(
        '/spaces',
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            spaces: z.array(z.object({
              id: z.string(),
              name: z.string(),
              isAdmin: z.boolean()
            }))
          }),
          message: z.string()
        })
      );
      
      // Convert AITable space format to expected format
      return {
        bases: response.data.spaces.map(space => ({
          id: space.id,
          name: space.name,
          permissionLevel: space.isAdmin ? 'owner' : 'read'
        })),
        offset: undefined // AITable doesn't provide offset pagination
      };
    }
  }

  /**
   * Get information about datasheets in a space
   */
  async getBaseSchema(baseId: string): Promise<BaseSchemaResponse> {
    try {
      // Try AITable API endpoint
      return await this.fetchFromAPI(
        `/v0/meta/bases/${baseId}/tables`,
        BaseSchemaResponseSchema
      );
    } catch (error) {
      // Fall back to AITable-style API
      // First, get all datasheets in the space using nodes API
      const nodesResponse = await this.fetchFromAPI(
        `/spaces/${baseId}/nodes?type=Datasheet`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            nodes: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              icon: z.string().optional()
            }))
          }),
          message: z.string()
        })
      );
      
      // Now we need to get fields for each datasheet and transform them to match the expected format
      const datasheetNodes = nodesResponse.data.nodes.filter(node => node.type === 'Datasheet');
      const tables: Table[] = [];
      
      for (const node of datasheetNodes) {
        try {
          // Get fields for this datasheet
          const fieldsResponse = await this.fetchFromAPI(
            `/datasheets/${node.id}/fields`,
            z.object({
              success: z.boolean(),
              code: z.number(),
              data: z.object({
                fields: z.array(z.object({
                  id: z.string(),
                  name: z.string(),
                  type: z.string(),
                  property: z.any().optional(),
                  editable: z.boolean().optional(),
                  isPrimary: z.boolean().optional(),
                  desc: z.string().optional()
                }))
              }),
              message: z.string()
            })
          );
          
          // Get views for this datasheet
          const viewsResponse = await this.fetchFromAPI(
            `/datasheets/${node.id}/views`,
            z.object({
              success: z.boolean(),
              code: z.number(),
              data: z.object({
                views: z.array(z.object({
                  id: z.string(),
                  name: z.string(),
                  type: z.string()
                }))
              }),
              message: z.string()
            })
          );
          
          // Find the primary field ID
          const primaryField = fieldsResponse.data.fields.find(field => field.isPrimary === true);
          const primaryFieldId = primaryField ? primaryField.id : fieldsResponse.data.fields[0]?.id || '';
          
          // Transform fields to match expected format
          const fields = fieldsResponse.data.fields.map(field => ({
            id: field.id,
            name: field.name,
            type: field.type,
            description: field.desc,
            options: field.property || {}
          }));
          
          // Create the table object with transformed data
          tables.push({
            id: node.id,
            name: node.name,
            primaryFieldId,
            fields,
            views: viewsResponse.data.views,
            description: ''
          });
        } catch (error) {
          console.error(`Error fetching details for datasheet ${node.id}:`, error);
        }
      }
      
      return {
        tables,
        bases: [] // This field isn't used anyway
      };
    }
  }

  /**
   * List records from a datasheet
   */
  async listRecords(baseId: string, tableId: string, options: ListRecordsOptions = {}): Promise<AITableRecord[]> {
    try {
      // Try Airtable-style API first
      const params = new URLSearchParams();
      
      if (options.maxRecords) {
        params.append('maxRecords', options.maxRecords.toString());
      }
      
      if (options.filterByFormula) {
        params.append('filterByFormula', options.filterByFormula);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await this.fetchFromAPI(
        `/v0/${baseId}/${tableId}/records${queryString}`,
        z.object({
          records: z.array(z.object({
            id: z.string(),
            fields: z.record(z.any()),
            createdTime: z.string().optional()
          })),
          offset: z.string().nullable().optional()
        })
      );
      
      // Airtable response is already in the right format
      return response.records;
    } catch (error) {
      // Fall back to AITable-style API
      const params = new URLSearchParams();
      
      if (options.maxRecords) {
        params.append('pageSize', options.maxRecords.toString());
      }
      
      if (options.filterByFormula) {
        params.append('filterByFormula', options.filterByFormula);
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : '';
      
      const response = await this.fetchFromAPI(
        `/datasheets/${tableId}/records${queryString}`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            records: z.array(z.object({
              recordId: z.string(),
              fields: z.record(z.any()),
              createdAt: z.number().optional(),
              updatedAt: z.number().optional()
            })),
            pageNum: z.number(),
            pageSize: z.number()
          }),
          message: z.string()
        })
      );
      
      // Transform records to match expected format
      return response.data.records.map(record => ({
        id: record.recordId,
        fields: record.fields
      }));
    }
  }

  /**
   * Get a specific record
   */
  async getRecord(baseId: string, tableId: string, recordId: string): Promise<AITableRecord> {
    try {
      // Try Airtable-style API first
      const response = await this.fetchFromAPI(
        `/v0/${baseId}/${tableId}/${recordId}`,
        z.object({
          id: z.string(),
          fields: z.record(z.any()),
          createdTime: z.string().optional()
        })
      );
      
      // Airtable response is already in the right format
      return {
        id: response.id,
        fields: response.fields
      };
    } catch (error) {
      // Fall back to AITable-style API using filterByFormula on assumed 'RecordID' field
      // Note: This assumes a field named 'RecordID' contains the record ID.
      console.warn(`Airtable-style getRecord failed for ${recordId}, falling back to listRecords with filterByFormula on RecordID field.`);
      try {
        const filterFormula = `{RecordID}='${recordId}'`;
        const options = { filterByFormula: filterFormula, maxRecords: 2 }; // Max 2 to detect duplicates
        const matchingRecords = await this.listRecords(baseId, tableId, options);

        if (matchingRecords.length === 1) {
          return matchingRecords[0];
        } else if (matchingRecords.length === 0) {
          throw new Error(`aitable-mcp-server: Record ${recordId} not found using RecordID filter.`);
        } else {
          // This case should ideally not happen if RecordID is unique
          console.error(`aitable-mcp-server: Found multiple records (${matchingRecords.length}) for RecordID ${recordId}. Returning the first one.`);
          return matchingRecords[0];
        }
      } catch (fallbackError) {
        console.error(`Error during AITable fallback using listRecords for record ${recordId}:`, fallbackError);
        // Re-throw the original error or a more specific fallback error
        throw new Error(`aitable-mcp-server: Failed to get record ${recordId}. Original error: ${error instanceof Error ? error.message : String(error)}. Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
  }

  /**
   * Create a new record
   */
  async createRecord(baseId: string, tableId: string, fields: FieldSet): Promise<AITableRecord> {
    const response = await this.fetchFromAPI(
      `/datasheets/${tableId}/records`,
      z.object({
        success: z.boolean(),
        code: z.number(),
        data: z.object({
          records: z.array(z.object({
            recordId: z.string(),
            fields: z.record(z.any())
          }))
        }),
        message: z.string()
      }),
      {
        method: 'POST',
        body: JSON.stringify({
          records: [{ fields }]
        }),
      }
    );
    
    if (!response.data.records.length) {
      throw new Error('aitable-mcp-server: Failed to create record, no record returned');
    }
    
    // Transform record to match expected format
    return {
      id: response.data.records[0].recordId,
      fields: response.data.records[0].fields
    };
  }

  /**
   * Update multiple records
   */
  async updateRecords(
    baseId: string,
    tableId: string,
    records: { id: string; fields: FieldSet }[],
  ): Promise<AITableRecord[]> {
    // Transform records to match AITable's format
    const aiTableRecords = records.map(record => ({
      recordId: record.id,
      fields: record.fields
    }));
    
    const response = await this.fetchFromAPI(
      `/datasheets/${tableId}/records`,
      z.object({
        success: z.boolean(),
        code: z.number(),
        data: z.object({
          records: z.array(z.object({
            recordId: z.string(),
            fields: z.record(z.any())
          }))
        }),
        message: z.string()
      }),
      {
        method: 'PATCH',
        body: JSON.stringify({ records: aiTableRecords }),
      }
    );
    
    // Transform records to match expected format
    return response.data.records.map(record => ({
      id: record.recordId,
      fields: record.fields
    }));
  }

  /**
   * Delete records
   */
  async deleteRecords(baseId: string, tableId: string, recordIds: string[]): Promise<{ id: string }[]> {
    const response = await this.fetchFromAPI(
      `/datasheets/${tableId}/records`,
      z.object({
        success: z.boolean(),
        code: z.number(),
        data: z.object({
          results: z.array(z.object({
            recordId: z.string(),
            deleted: z.boolean()
          }))
        }),
        message: z.string()
      }),
      {
        method: 'DELETE',
        body: JSON.stringify({ recordIds }),
      }
    );
    
    // Transform records to match expected format
    return response.data.results
      .filter(result => result.deleted)
      .map(result => ({ id: result.recordId }));
  }

  /**
   * Create a new datasheet (table)
   */
  async createTable(baseId: string, name: string, fields: Field[], description?: string): Promise<Table> {
    // Transform fields to match AITable's format
    const aiTableFields = fields.map(field => ({
      name: field.name,
      type: field.type,
      desc: field.description || '',
      property: field.options || {}
    }));
    
    const response = await this.fetchFromAPI(
      `/spaces/${baseId}/datasheets`,
      z.object({
        success: z.boolean(),
        code: z.number(),
        data: z.object({
          datasheetId: z.string()
        }),
        message: z.string()
      }),
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description || '',
          fields: aiTableFields
        }),
      }
    );
    
    // After creating the datasheet, fetch its complete schema
    const tableSchema = await this.getBaseSchema(baseId);
    const createdTable = tableSchema.tables.find(table => table.id === response.data.datasheetId);
    
    if (!createdTable) {
      throw new Error(`aitable-mcp-server: Created datasheet not found in schema`);
    }
    
    return createdTable;
  }

  /**
   * Update a datasheet's name or description
   */
  async updateTable(
    baseId: string,
    tableId: string,
    updates: { name?: string; description?: string },
  ): Promise<Table> {
    await this.fetchFromAPI(
      `/datasheets/${tableId}`,
      z.object({
        success: z.boolean(),
        code: z.number(),
        data: z.object({
          updated: z.boolean()
        }),
        message: z.string()
      }),
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: updates.name,
          desc: updates.description
        }),
      }
    );

    // After updating, fetch the datasheet schema to get the latest
    const tableSchema = await this.getBaseSchema(baseId);
    const updatedTable = tableSchema.tables.find(table => table.id === tableId);
    
    if (!updatedTable) {
      throw new Error(`aitable-mcp-server: Updated datasheet not found in schema`);
    }
    
    return updatedTable;
  }

  async createField(baseId: string, tableId: string, field: Omit<Field, 'id'>): Promise<Field> {
    try {
      // Try Airtable-style API first
      return await this.fetchFromAPI(
        `/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
          options: z.record(z.string(), z.any()).optional(),
        }),
        {
          method: 'POST',
          body: JSON.stringify(field),
        }
      );
    } catch (error) {
      // Fall back to AITable-style API
      const response = await this.fetchFromAPI(
        `/datasheets/${tableId}/fields`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            field: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              desc: z.string().optional(),
              property: z.record(z.string(), z.any()).optional(),
            }),
          }),
          message: z.string(),
        }),
        {
          method: 'POST',
          body: JSON.stringify({
            name: field.name,
            type: field.type,
            desc: field.description,
            property: field.options,
          }),
        }
      );
      
      // Transform response to match expected format
      return {
        id: response.data.field.id,
        name: response.data.field.name,
        type: response.data.field.type,
        description: response.data.field.desc,
        options: response.data.field.property,
      };
    }
  }

  async updateField(
    baseId: string,
    tableId: string,
    fieldId: string,
    updates: { name?: string; description?: string }
  ): Promise<Field> {
    try {
      // Try Airtable-style API first
      return await this.fetchFromAPI(
        `/v0/meta/bases/${baseId}/tables/${tableId}/fields/${fieldId}`,
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          description: z.string().optional(),
          options: z.record(z.string(), z.any()).optional(),
        }),
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
    } catch (error) {
      // Fall back to AITable-style API
      const response = await this.fetchFromAPI(
        `/datasheets/${tableId}/fields/${fieldId}`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            field: z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              desc: z.string().optional(),
              property: z.record(z.string(), z.any()).optional(),
            }),
          }),
          message: z.string(),
        }),
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: updates.name,
            desc: updates.description,
          }),
        }
      );
      
      // Transform response to match expected format
      return {
        id: response.data.field.id,
        name: response.data.field.name,
        type: response.data.field.type,
        description: response.data.field.desc,
        options: response.data.field.property,
      };
    }
  }

  async searchRecords(
    baseId: string,
    tableId: string,
    searchTerm: string,
    fieldIds?: string[],
    maxRecords?: number
  ): Promise<AITableRecord[]> {
    try {
      // Try Airtable-style API first
      const searchParams = new URLSearchParams();
      searchParams.append('search', searchTerm);
      if (maxRecords) {
        searchParams.append('maxRecords', maxRecords.toString());
      }
      if (fieldIds && fieldIds.length > 0) {
        searchParams.append('fields', fieldIds.join(','));
      }
      
      const endpoint = `/v0/${baseId}/${tableId}/search?${searchParams.toString()}`;
      
      const response = await this.fetchFromAPI(
        endpoint,
        z.object({
          records: z.array(
            z.object({
              id: z.string(),
              fields: z.record(z.string(), z.any()),
            })
          ),
          offset: z.string().optional(),
        })
      );
      
      return response.records;
    } catch (error) {
      // Fall back to AITable-style API
      // Construct query parameters
      const params: Record<string, string> = {
        keyword: searchTerm,
      };
      
      if (maxRecords) {
        params.pageSize = maxRecords.toString();
      }
      
      const searchParams = new URLSearchParams(params);
      const endpoint = `/datasheets/${tableId}/search?${searchParams.toString()}`;
      
      const response = await this.fetchFromAPI(
        endpoint,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            records: z.array(
              z.object({
                recordId: z.string(),
                data: z.record(z.string(), z.any()),
              })
            ),
          }),
          message: z.string(),
        })
      );
      
      // Transform records to match expected format
      return response.data.records.map(record => ({
        id: record.recordId,
        fields: record.data,
      }));
    }
  }

  /**
   * Recursively discovers all datasheets in a space, including those in folders
   * @param spaceId ID of the space to search
   * @returns Array of datasheet information objects containing id, name, and location path
   */
  async getAllDatasheets(spaceId: string): Promise<DatasheetInfo[]> {
    const allDatasheets: DatasheetInfo[] = [];
    
    // Get top-level nodes in the space
    try {
      const nodesResponse = await this.fetchFromAPI(
        `/spaces/${spaceId}/nodes`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            nodes: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string(),
              icon: z.string().optional()
            }))
          }),
          message: z.string()
        })
      );
      
      if (!nodesResponse.success || !nodesResponse.data.nodes) {
        return [];
      }
      
      // First, directly identify datasheets at the root level
      const rootDatasheets = nodesResponse.data.nodes.filter(node => node.type === 'Datasheet');
      for (const datasheet of rootDatasheets) {
        allDatasheets.push({
          id: datasheet.id,
          name: datasheet.name,
          path: datasheet.name,
          spaceId: spaceId
        });
      }
      
      // Process all folders to find nested datasheets
      const folders = nodesResponse.data.nodes.filter(node => node.type === 'Folder');
      for (const folder of folders) {
        await this.processNode(spaceId, folder.id, '', allDatasheets);
      }
      
      return allDatasheets;
    } catch (error) {
      console.error(`Error getting datasheets for space ${spaceId}:`, error);
      return [];
    }
  }
  
  /**
   * Gets records from a datasheet by its name
   * @param spaceId ID of the space containing the datasheet
   * @param datasheetName Name of the datasheet to get records from
   * @param options Optional parameters for filtering and limiting records
   * @returns Array of records from the datasheet
   */
  async getDatasheetRecordsByName(
    spaceId: string,
    datasheetName: string,
    options: ListRecordsOptions = {}
  ): Promise<AITableRecord[]> {
    try {
      // First, get all datasheets to find the one with the matching name
      const datasheets = await this.getAllDatasheets(spaceId);
      
      // Find the datasheet with the requested name
      const datasheet = datasheets.find(ds => ds.name === datasheetName);
      
      if (!datasheet) {
        throw new Error(`Datasheet named "${datasheetName}" not found in space ${spaceId}`);
      }
      
      // Now get the records from this datasheet
      return await this.listRecords(spaceId, datasheet.id, options);
    } catch (error) {
      console.error(`Error getting records from datasheet "${datasheetName}":`, error);
      throw error;
    }
  }
  
  /**
   * Recursively processes a folder node to find datasheets
   * @private
   */
  private async processNode(
    spaceId: string, 
    nodeId: string, 
    nodePath: string, 
    allDatasheets: DatasheetInfo[]
  ): Promise<void> {
    try {
      // Get node details
      const nodeDetails = await this.fetchFromAPI(
        `/spaces/${spaceId}/nodes/${nodeId}`,
        z.object({
          success: z.boolean(),
          code: z.number(),
          data: z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            icon: z.string().optional(),
            children: z.array(z.object({
              id: z.string(),
              name: z.string(),
              type: z.string()
            })).optional(),
          }),
          message: z.string()
        })
      );
      
      if (!nodeDetails.success || !nodeDetails.data) {
        return;
      }
      
      const node = nodeDetails.data;
      const currentPath = nodePath ? `${nodePath} > ${node.name}` : node.name;
      
      if (node.type === 'Datasheet') {
        allDatasheets.push({
          id: node.id,
          name: node.name,
          path: currentPath,
          spaceId: spaceId
        });
        return;
      }
      
      // If it's a folder and has children, process each child
      if (node.type === 'Folder' && node.children && node.children.length > 0) {
        for (const childNode of node.children) {
          await this.processNode(spaceId, childNode.id, currentPath, allDatasheets);
        }
      }
    } catch (error) {
      console.error(`Error processing node ${nodeId}:`, error);
    }
  }
}
