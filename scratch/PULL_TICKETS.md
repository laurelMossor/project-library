# Pull Notion Tickets and Create Next Steps Plan

## Instructions

1. **Call the API endpoint:**
   ```
   GET /api/notion/tickets
   ```

2. **The API returns:**
   - P0 priority tickets
   - Status: "In Progress" OR "Not Started"
   - Epic: "𝚫 ORGS"
   - Fields: Title, Status, Priority, Epic, Description

3. **Create a next steps plan:**
   - Review each ticket's title and description
   - Identify actionable tasks needed to complete each ticket
   - Write a clear, structured plan with specific next steps

4. **Format the plan:**
   - For each ticket:
     - Find where the updates need to be made
     - Include what needs to be done
     - Prefer following existing patterns and using existing components and styling
