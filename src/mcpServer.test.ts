import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { AirtableMCPServer } from './mcpServer.js';
import type { IAirtableService } from './types.js';
import type { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

describe('AirtableMCPServer', () => {
  let server: AirtableMCPServer;
  let mockAirtableService: IAirtableService;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create mock AirtableService
    mockAirtableService = {
      listBases: vi.fn().mockResolvedValue({
        bases: [
          { id: 'base1', name: 'Test Base', permissionLevel: 'create' }
        ]
      }),
      getBaseSchema: vi.fn().mockResolvedValue({
        tables: [
          {
            id: 'tbl1',
            name: 'Test Table',
            description: 'Test Description',
            fields: [],
            views: [],
            primaryFieldId: 'fld1'
          }
        ]
      }),
      listRecords: vi.fn().mockResolvedValue([
        { id: 'rec1', fields: { name: 'Test Record' } }
      ]),
      getRecord: vi.fn().mockResolvedValue({
        id: 'rec1',
        fields: { name: 'Test Record' }
      }),
      createRecord: vi.fn().mockResolvedValue({
        id: 'rec1',
        fields: { name: 'New Record' }
      }),
      updateRecords: vi.fn().mockResolvedValue([
        { id: 'rec1', fields: { name: 'Updated Record' } }
      ]),
      deleteRecords: vi.fn().mockResolvedValue([
        { id: 'rec1', deleted: true }
      ]),
      createTable: vi.fn().mockResolvedValue({
        id: 'tbl1',
        name: 'New Table',
        fields: []
      }),
      updateTable: vi.fn().mockResolvedValue({
        id: 'tbl1',
        name: 'Updated Table',
        fields: []
      }),
      createField: vi.fn().mockResolvedValue({
        id: 'fld1',
        name: 'New Field',
        type: 'singleLineText'
      }),
      updateField: vi.fn().mockResolvedValue({
        id: 'fld1',
        name: 'Updated Field',
        type: 'singleLineText'
      }),
    };

    // Create server instance with test transport
    server = new AirtableMCPServer(mockAirtableService);
    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
  });

  const sendRequest = async (message: JSONRPCRequest): Promise<JSONRPCResponse> => {
    return new Promise((resolve) => {
      // Set up response handler
      clientTransport.onmessage = (response: JSONRPCMessage) => {
        resolve(response as JSONRPCResponse);
      };
      
      clientTransport.send(message);
    });
  };

  describe('server functionality', () => {
    test('handles list_resources request', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        id: '1',
        method: 'resources/list',
        params: {}
      });

      expect(response.result).toEqual({
        resources: [{
          uri: 'airtable://base1/tbl1/schema',
          mimeType: 'application/json',
          name: 'Test Base: Test Table schema',
        }]
      });
    });

    test('handles read_resource request', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        id: '1',
        method: 'resources/read',
        params: {
          uri: 'airtable://base1/tbl1/schema'
        }
      });

      expect(response.result).toEqual({
        contents: [{
          uri: 'airtable://base1/tbl1/schema',
          mimeType: 'application/json',
          text: JSON.stringify({
            baseId: 'base1',
            tableId: 'tbl1',
            name: 'Test Table',
            description: 'Test Description',
            primaryFieldId: 'fld1',
            fields: [],
            views: [],
          })
        }]
      });
    });

    test('handles list_tools request', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/list',
        params: {}
      });

      expect(response.result.tools).toHaveLength(11);
      expect((response.result.tools as Tool[])[0]).toMatchObject({
        name: 'list_records',
        description: expect.any(String),
        inputSchema: expect.objectContaining({
          type: 'object'
        })
      });
    });

    test('handles list_records tool call', async () => {
      const response = await sendRequest({
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/call',
        params: {
          name: 'list_records',
          arguments: {
            baseId: 'base1',
            tableId: 'tbl1',
            maxRecords: 100
          }
        }
      });

      expect(response.result).toEqual({
        content: [{
          type: 'text',
          mimeType: 'application/json',
          text: JSON.stringify([
            { id: 'rec1', fields: { name: 'Test Record' } }
          ])
        }],
        isError: false
      });
    });
  });

  afterEach(async () => {
    await server.close();
  });
});
