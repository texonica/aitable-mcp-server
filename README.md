# airtable-mcp-server

A Model Context Protocol server that provides read and write access to Airtable databases. This server enables LLMs to inspect database schemas, then read and write records.

## Usage

To use this server with the Claude Desktop app, add the following configuration to the "mcpServers" section of your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "airtable-mcp-server",
        "pat123.abc123"
      ]
    }
  }
}
```

Replace `pat123.abc123` with your [Airtable personal access token](https://airtable.com/create/tokens). Your token should have at least `schema.bases:read` and `data.records:read`, and optionally the corresponding write permissions.

## Components

### Tools

- **list_records**
  - Lists records from a specified Airtable table
  - Input parameters:
    - `baseId` (string, required): The ID of the Airtable base
    - `tableId` (string, required): The ID of the table to query
    - `maxRecords` (number, optional): Maximum number of records to return (defaults to 100)

### Resources

The server provides schema information for Airtable bases and tables:

- **Table Schemas** (`airtable://<baseId>/<tableId>/schema`)
  - JSON schema information for each table
  - Includes:
    - Base id and table id
    - Table name and description
    - Primary field ID
    - Field definitions (ID, name, type, description, options)
    - View definitions (ID, name, type)
  - Automatically discovered from Airtable's metadata API

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.
