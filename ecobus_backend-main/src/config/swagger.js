import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'EcoBus V2 API',
    version: '1.0.0',
    description:
      'Smart school-bus tracking platform. Multi-tenant REST API with JWT auth, '
      + 'real-time GPS ingestion, fleet management, child check-ins, SOS alerts and analytics.',
    contact: { name: 'EcoBus Team', email: 'support@ecobus.tn' },
    license: { name: 'Proprietary' },
  },
  servers: [
    ...(process.env.PUBLIC_BASE_URL
      ? [{ url: `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}${env.apiPrefix}`, description: 'Configured (PUBLIC_BASE_URL)' }]
      : []),
    { url: `http://localhost:${env.port}${env.apiPrefix}`, description: 'Local dev' },
    { url: `https://api.ecobus.tn${env.apiPrefix}`, description: 'Production' },
  ],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Logs', description: 'Backend log viewer (token-protected)' },
    { name: 'Auth', description: 'Registration, login, profile, password' },
    { name: 'Users', description: 'User & role management (admin only)' },
    { name: 'Buses', description: 'Fleet management' },
    { name: 'Children', description: 'Children profiles and route assignments' },
    { name: 'Drivers', description: 'Driver listing and route assignments' },
    { name: 'Routes', description: 'Routes and stops' },
    { name: 'Trips', description: 'Trip lifecycle' },
    { name: 'GPS', description: 'Real-time location ingestion' },
    { name: 'Check-ins', description: 'Student boarding events' },
    { name: 'SOS', description: 'Emergency alerts' },
    { name: 'Notifications', description: 'User notifications' },
    { name: 'Analytics', description: 'Product analytics events' },
    { name: 'Dev', description: 'Developer utilities — seed demo data, status snapshots. Not protected; do not enable on production without restrictions.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      RequestIdHeader: {
        in: 'header',
        name: 'X-Request-Id',
        required: false,
        schema: { type: 'string', maxLength: 128 },
        description:
          'Optional client-supplied correlation id. Echoed back in the '
          + '`X-Request-Id` response header and included in every error '
          + 'response body and server log line for end-to-end tracing.',
      },
    },
    headers: {
      XRequestId: {
        description: 'Correlation id for this request (generated if not provided).',
        schema: { type: 'string' },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          issues: { type: 'array', items: { type: 'object' } },
        },
      },
      ReadinessReport: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          totalLatencyMs: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
          checks: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'down', 'unknown'] },
                  latencyMs: { type: 'integer', nullable: true },
                  error: { type: 'string', nullable: true },
                },
              },
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok', 'incomplete', 'error', 'skipped', 'unknown'] },
                  present: { type: 'integer' },
                  required: { type: 'integer' },
                  missing: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
          organization: { $ref: '#/components/schemas/Organization' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['organizationName', 'firstName', 'lastName', 'email', 'password'],
        properties: {
          organizationName: { type: 'string', example: 'Lycée Pilote Tunis' },
          firstName: { type: 'string', example: 'Sami' },
          lastName: { type: 'string', example: 'Ben Ali' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          password: { type: 'string', minLength: 8 },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      RegisterParentInput: {
        type: 'object',
        required: ['organizationId', 'firstName', 'lastName', 'email', 'password'],
        properties: {
          organizationId: { type: 'string', format: 'uuid' },
          firstName: { type: 'string', example: 'Leila' },
          lastName: { type: 'string', example: 'Trabelsi' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          password: { type: 'string', minLength: 8 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organization_id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone: { type: 'string', nullable: true },
          roles: { type: 'array', items: { type: 'string' } },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
      },
      CreateUserInput: {
        type: 'object',
        required: ['firstName', 'lastName', 'email', 'password', 'roles'],
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          password: { type: 'string', minLength: 8 },
          roles: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: ['super_admin', 'admin', 'school_manager', 'driver', 'parent'] },
          },
        },
      },
      UpdateUserInput: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          isActive: { type: 'boolean' },
          roles: {
            type: 'array',
            items: { type: 'string', enum: ['super_admin', 'admin', 'school_manager', 'driver', 'parent'] },
          },
        },
      },
      UpdateProfileInput: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
        },
      },
      Bus: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          plate_number: { type: 'string' },
          capacity: { type: 'integer' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      BusInput: {
        type: 'object',
        required: ['name', 'plateNumber', 'capacity'],
        properties: {
          name: { type: 'string' },
          plateNumber: { type: 'string' },
          capacity: { type: 'integer', minimum: 1, maximum: 200 },
          status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
        },
      },
      Child: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          organization_id: { type: 'string', format: 'uuid' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          date_of_birth: { type: 'string', format: 'date', nullable: true },
          parent_id: { type: 'string', format: 'uuid', nullable: true },
          routes: { type: 'array', items: { type: 'object' } },
        },
      },
      ChildInput: {
        type: 'object',
        required: ['firstName', 'lastName'],
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          dateOfBirth: { type: 'string', example: '2015-04-12' },
          parentId: { type: 'string', format: 'uuid' },
        },
      },
      ChildRouteInput: {
        type: 'object',
        required: ['routeId'],
        properties: {
          routeId: { type: 'string', format: 'uuid' },
          pickupStopId: { type: 'string', format: 'uuid' },
          dropoffStopId: { type: 'string', format: 'uuid' },
        },
      },
      Assignment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          route_id: { type: 'string', format: 'uuid' },
          bus_id: { type: 'string', format: 'uuid' },
          driver_id: { type: 'string', format: 'uuid' },
          start_date: { type: 'string', format: 'date', nullable: true },
          end_date: { type: 'string', format: 'date', nullable: true },
          is_active: { type: 'boolean' },
        },
      },
      AssignmentInput: {
        type: 'object',
        required: ['routeId', 'busId', 'driverId'],
        properties: {
          routeId: { type: 'string', format: 'uuid' },
          busId: { type: 'string', format: 'uuid' },
          driverId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', example: '2025-09-01' },
          endDate: { type: 'string', example: '2026-06-30' },
          isActive: { type: 'boolean' },
        },
      },
      LiveStatus: {
        type: 'object',
        properties: {
          bus_id: { type: 'string', format: 'uuid' },
          trip_id: { type: 'string', format: 'uuid', nullable: true },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          speed: { type: 'number', nullable: true },
          heading: { type: 'number', nullable: true },
          battery_level: { type: 'integer', nullable: true },
          gps_status: { type: 'string' },
          last_update: { type: 'string', format: 'date-time' },
        },
      },
      Route: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      RouteInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      Stop: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          stop_order: { type: 'integer' },
          planned_time: { type: 'string', nullable: true },
        },
      },
      StopInput: {
        type: 'object',
        required: ['name', 'latitude', 'longitude', 'stopOrder'],
        properties: {
          name: { type: 'string' },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          stopOrder: { type: 'integer', minimum: 0 },
          plannedTime: { type: 'string', example: '07:30:00' },
        },
      },
      Trip: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          route_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', example: 'in_progress' },
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      TripInput: {
        type: 'object',
        required: ['routeId'],
        properties: {
          routeId: { type: 'string', format: 'uuid' },
          assignmentId: { type: 'string', format: 'uuid' },
        },
      },
      GpsInput: {
        type: 'object',
        required: ['busId', 'latitude', 'longitude'],
        properties: {
          busId: { type: 'string', format: 'uuid', example: '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b' },
          tripId: { type: 'string', format: 'uuid', example: 'b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901' },
          latitude: { type: 'number', example: 36.8065 },
          longitude: { type: 'number', example: 10.1815 },
          speed: { type: 'number', description: 'm/s', example: 12.4 },
          heading: { type: 'number', description: 'degrees 0-360', example: 87.5 },
          accuracy: { type: 'number', description: 'meters', example: 8.2 },
          batteryLevel: { type: 'integer', minimum: 0, maximum: 100, example: 73 },
        },
      },
      GpsLogEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-5e6f-4708-91a2-b3c4d5e6f708' },
          trip_id: { type: 'string', format: 'uuid', nullable: true, example: 'b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901' },
          bus_id: { type: 'string', format: 'uuid', example: '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b' },
          latitude: { type: 'number', example: 36.8065 },
          longitude: { type: 'number', example: 10.1815 },
          speed: { type: 'number', nullable: true, example: 12.4 },
          heading: { type: 'number', nullable: true, example: 87.5 },
          accuracy: { type: 'number', nullable: true, example: 8.2 },
          battery_level: { type: 'integer', nullable: true, example: 73 },
          recorded_at: { type: 'string', format: 'date-time', example: '2026-04-27T08:15:32.000Z' },
        },
      },
      Checkin: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          trip_id: { type: 'string', format: 'uuid' },
          child_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['boarded', 'left', 'absent'] },
          method: { type: 'string', enum: ['manual', 'qr', 'nfc'] },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      CheckinInput: {
        type: 'object',
        required: ['tripId', 'childId', 'status'],
        properties: {
          tripId: { type: 'string', format: 'uuid' },
          childId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['boarded', 'left', 'absent'] },
          method: { type: 'string', enum: ['manual', 'qr', 'nfc'] },
        },
      },
      SosAlert: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          trip_id: { type: 'string', format: 'uuid', nullable: true },
          latitude: { type: 'number', nullable: true },
          longitude: { type: 'number', nullable: true },
          status: { type: 'string', example: 'active' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      SosInput: {
        type: 'object',
        properties: {
          tripId: { type: 'string', format: 'uuid', example: 'b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901' },
          latitude: { type: 'number', example: 36.8065 },
          longitude: { type: 'number', example: 10.1815 },
          message: { type: 'string', maxLength: 500, example: 'Engine smoke, pulling over' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string' },
          is_read: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AnalyticsEventInput: {
        type: 'object',
        required: ['eventType'],
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          eventType: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      DevSeedResponse: {
        type: 'object',
        description: 'Standard envelope wrapping the seed result. The interesting payload lives in `data`.',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'OK' },
          data: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', example: true },
              durationMs: { type: 'integer', description: 'Total seed runtime in milliseconds.', example: 2451 },
              counts: {
                type: 'object',
                description: 'Row count per table after seeding completed. A string starting with `error:` means the COUNT(*) failed for that table (usually a missing migration).',
                additionalProperties: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
                example: {
                  organizations: 3, users: 39, roles: 5, buses: 12, routes: 9,
                  route_stops: 36, route_assignments: 9, children: 36,
                  child_routes: 36, trips: 9, gps_logs: 150,
                },
              },
              demoPassword: { type: 'string', example: 'Admin@1234' },
              organizations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', example: 'demo' },
                    name: { type: 'string', example: 'Demo School' },
                  },
                },
              },
              logins: {
                type: 'object',
                description: 'Quick-reference credentials for each seeded role. All use `demoPassword`.',
                properties: {
                  super_admin: { type: 'string', example: 'root@ecobus.demo' },
                  admin: { type: 'string', example: 'admin@demo.demo' },
                  manager: { type: 'string', example: 'manager@demo.demo' },
                  driver: { type: 'string', example: 'driver@ecobus.demo' },
                  parent: { type: 'string', example: 'parent@ecobus.demo' },
                },
              },
            },
          },
        },
      },
      DevStatusResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'OK' },
          data: {
            type: 'object',
            properties: {
              counts: {
                type: 'object',
                additionalProperties: { type: 'integer' },
                example: { organizations: 3, users: 39, buses: 12, routes: 9, trips: 9, children: 36 },
              },
              activeTrips: { type: 'integer', example: 3 },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: ['./src/routes/*.js'],
});
