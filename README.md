This application provides a complete way of planning for development teams, via checklists (same as GitHub project board) 
and allows users with different roles to perform certain tasks.

There are 3 Roles: 
    1. Chief Information Officer (CIO)
    2. Product Owner (PO)
    3. Developer (Dev)

The CIO can perform the following tasks:
    - can switch between different development teams to track progress
    - can add, modify and delete tasks
    - can (un)assign roles and groups to users

The PO can perform the following tasks:
    - can see their development team's progress
    - can modify the status of a task (from "In progress" to "Done")
    - can submit "Done" tasks for the CIO to review
    - can view users but cannot assign roles or groups

The Developer can:
    - see tasks 
    - see users

This application follows a microservice architecture, as we have 2 services in the application:
    - the checklist microservice (for storing and managing checklists)
    - the authentication microservice (anything that depends on Keycloak - users, groups, roles etc.)

The application has the following architecture: 

![Application Architecture]("images/ArchitectureDiagram.png")
