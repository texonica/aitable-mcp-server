# aitable-mcp-server

[![smithery badge](https://smithery.ai/badge/aitable-mcp-server)](https://smithery.ai/server/aitable-mcp-server)

A Model Context Protocol server that provides read and write access to AITable databases. This server enables LLMs to inspect database schemas, then read and write records.

https://github.com/user-attachments/assets/c8285e76-d0ed-4018-94c7-20535db6c944

## Usage

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aitable": {
      "command": "npx",
      "args": [
        "-y",
        "aitable-mcp-server"
      ],
      "env": {
        "AITABLE_API_KEY": "pat123.abc123"
      }
    }
  }
}
```

Replace `pat123.abc123` with your AITable personal access token. Your token should have sufficient read and write permissions.

## Components

### Tools

- **list_records**
  - Lists records from a specified AITable table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table to query
    - `maxRecords` (number, optional): Maximum number of records to return. Defaults to 100.
    - `filterByFormula` (string, optional): Formula to filter records

- **search_records**
  - Search for records containing specific text
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table to query
    - `searchTerm` (string, required): Text to search for in records
    - `fieldIds` (array, optional): Specific field IDs to search in. If not provided, searches all text-based fields.
    - `maxRecords` (number, optional): Maximum number of records to return. Defaults to 100.

- **list_bases**
  - Lists all accessible AITable bases
  - No input parameters required
  - Returns base ID, name, and permission level

- **list_tables**
  - Lists all tables in a specific base
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `detailLevel` (string, optional): The amount of detail to get about the tables (`tableIdentifiersOnly`, `identifiersOnly`, or `full`)
  - Returns table ID, name, description, fields, and views (to the given `detailLevel`)

- **describe_table**
  - Gets detailed information about a specific table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table to describe
    - `detailLevel` (string, optional): The amount of detail to get about the table (`tableIdentifiersOnly`, `identifiersOnly`, or `full`)
  - Returns the same format as list_tables but for a single table
  - Useful for getting details about a specific table without fetching information about all tables in the base

- **get_record**
  - Gets a specific record by ID
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `recordId` (string, required): The ID of the record to retrieve

- **create_record**
  - Creates a new record in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `fields` (object, required): The fields and values for the new record

- **update_records**
  - Updates one or more records in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `records` (array, required): Array of objects containing record ID and fields to update

- **delete_records**
  - Deletes one or more records from a table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `recordIds` (array, required): Array of record IDs to delete

- **create_table**
  - Creates a new table in a base
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `name` (string, required): Name of the new table
    - `description` (string, optional): Description of the table
    - `fields` (array, required): Array of field definitions (name, type, description, options)

- **update_table**
  - Updates a table's name or description
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `name` (string, optional): New name for the table
    - `description` (string, optional): New description for the table

- **create_field**
  - Creates a new field in a table
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `name` (string, required): Name of the new field
    - `type` (string, required): Type of the field
    - `description` (string, optional): Description of the field
    - `options` (object, optional): Field-specific options

- **update_field**
  - Updates a field's name or description
  - Input parameters:
    - `baseId` (string, required): The ID of the AITable base
    - `tableId` (string, required): The ID of the table
    - `fieldId` (string, required): The ID of the field
    - `name` (string, optional): New name for the field
    - `description` (string, optional): New description for the field

### Resources

The server provides schema information for AITable bases and tables:

- **Table Schemas** (`aitable://<baseId>/<tableId>/schema`)
  - JSON schema information for each table
  - Includes:
    - Base id and table id
    - Table name and description
    - Primary field ID
    - Field definitions (ID, name, type, description, options)
    - View definitions (ID, name, type)
  - Automatically discovered from AITable's metadata API

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository from https://github.com/texonica/aitable-mcp-server
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`
  - You can use `npm run build:watch` to automatically build after editing [`src/index.ts`](./src/index.ts). This means you can hit save, reload Claude Desktop (with Ctrl/Cmd+R), and the changes apply.

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.

## Acknowledgments

This project is a fork of [domdomegg/airtable-mcp-server](https://github.com/domdomegg/airtable-mcp-server), modified to work with AITable rather than Airtable.

## Debugging

The AITable MCP server includes comprehensive logging and debugging tools to help diagnose issues with the AITable API connection.

### Log Files

Logs are stored in the `logs` directory and include:
- API requests and responses
- Error details
- Connection information
- Authentication issues

### Debug Scripts

There are several debug scripts available:

1. **Direct API Test**

   Run this script to test the direct API connection to AITable without the MCP server:

   ```bash
   npm run debug
   # or
   ./scripts/debug-api.sh
   ```

   This will create a detailed log file in the `logs` directory with API request/response information.

2. **Debug Server Mode**

   Run the MCP server with enhanced debugging:

   ```bash
   ./scripts/debug-server.sh
   ```

   This will start the server with detailed logging enabled.

### Debugging Configuration

You can enable debug logging by setting environment variables:

```bash
# In your .env file
LOG_LEVEL=debug
# or 
DEBUG=true
```

### Common Issues

1. **Authentication Errors (401 Unauthorized)**
   - Check that your API key is correct
   - Ensure the key is properly formatted without a "Bearer" prefix
   - Verify the key has access to the spaces you're trying to use

2. **JSON Parsing Errors**
   - May indicate an invalid response from the AITable API
   - Check the logs for the actual response content

3. **API URL Issues**
   - The server uses `https://aitable.ai/fusion/v1` as the base URL
   - Confirm this is correct for your AITable instance

To get more help, run the debug scripts and share the generated log files (after removing any sensitive information).
