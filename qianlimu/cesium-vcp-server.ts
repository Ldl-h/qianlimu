/**
 * CesiumJS VCP Server
 * Provides tools for controlling CesiumJS through the Virtual Cherry-Var Protocol
 */

import { z } from 'zod';
import type { BrowserTransport, VCPMessage } from './browser-transport';
import type { CesiumCommand, CartographicPosition, CZMLPacket } from './types';
import * as czmlGenerator from './czml-generator';
import { resolveLocationName } from './locations';
import { CoursewareManager } from './courseware-manager';
import { GeographyDrawing } from './types';

const positionSchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  height: z.number().optional(),
});

const colorSchema = z.enum([
  'red', 'green', 'blue', 'yellow', 'orange', 'purple',
  'pink', 'cyan', 'white', 'black', 'gray', 'grey'
]);

const tools = {
  flyToLocation: {
    name: 'flyToLocation',
    description: 'Fly the camera to a named location.',
    inputSchema: z.object({
      locationName: z.string().describe('Name of the place to fly to (e.g., "Paris", "Golden Gate Bridge")'),
      height: z.number().positive().optional().describe('Camera height in meters'),
      duration: z.number().positive().optional().describe('Flight duration in seconds'),
      screenshot: z.boolean().optional().describe('Whether to take a screenshot after flying'),
    }),
  },
  flyTo: {
    name: 'flyTo',
    description: 'Fly the camera to specific coordinates.',
    inputSchema: z.object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      height: z.number().positive().optional(),
      duration: z.number().positive().optional(),
      screenshot: z.boolean().optional(),
    }),
  },
  addPoint: {
    name: 'addPoint',
    description: 'Add a point marker at a location',
    inputSchema: z.object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      name: z.string().optional(),
      color: colorSchema.optional(),
      size: z.number().positive().optional(),
    }),
  },
  addLabel: {
    name: 'addLabel',
    description: 'Add a text label at a location',
    inputSchema: z.object({
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      text: z.string(),
      color: colorSchema.optional(),
    }),
  },
  removeEntity: {
    name: 'removeEntity',
    description: 'Remove an entity by its ID',
    inputSchema: z.object({
      id: z.string(),
    }),
  },
  clearAll: {
    name: 'clearAll',
    description: 'Remove all entities from the scene',
    inputSchema: z.object({}),
  },
  setSceneMode: {
    name: 'setSceneMode',
    description: 'Change the scene viewing mode',
    inputSchema: z.object({
      mode: z.enum(['2D', '3D', 'COLUMBUS_VIEW']),
    }),
  },
  loadCourseware: {
    name: 'loadCourseware',
    description: 'Load all groups and drawings from the courseware and display them on the map.',
    inputSchema: z.object({}),
  },
  addCoursewareDrawing: {
    name: 'addCoursewareDrawing',
    description: 'Add a new drawing to a specific group in the courseware and update the map.',
    inputSchema: z.object({
      groupName: z.string().describe('The name of the group to add this drawing to (e.g., "春秋战国")'),
      name: z.string().describe('The unique name of the point/location'),
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
      label: z.string().optional().describe('Detailed description or label text'),
      largeRegion: z.string().optional(),
      smallRegion: z.string().optional(),
      color: colorSchema.optional(),
      size: z.number().positive().optional(),
      associations: z.array(z.string()).optional().describe('Names of other points in the SAME group to connect with lines'),
    }),
  },
  removeCoursewareItem: {
    name: 'removeCoursewareItem',
    description: 'Remove a group, points, or an association from the courseware.',
    inputSchema: z.object({
      level: z.enum(['group', 'point', 'line']).describe('The level of the item to remove'),
      groupName: z.string().describe('The name of the group'),
      name: z.string().optional().describe('The name of the group (if level is group) or the association (e.g., "A-B" if level is line)'),
      pointNames: z.array(z.string()).optional().describe('List of point names to remove (if level is point)'),
    }),
  },
};

type ToolName = keyof typeof tools;
type CommandHandler = (command: CesiumCommand) => Promise<{ success: boolean; message: string; data?: any }>;

export class CesiumVCPServer {
  private transport: BrowserTransport;
  private commandHandler: CommandHandler;
  private coursewareManager: CoursewareManager;

  constructor(transport: BrowserTransport, commandHandler: CommandHandler) {
    this.transport = transport;
    this.commandHandler = commandHandler;
    this.coursewareManager = new CoursewareManager();
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    this.transport.onMessage(async (message: VCPMessage) => {
      if (message.method === 'tools/call') {
        const params = message.params as { name: string; arguments: any };
        try {
          const result = await this.handleToolCall(params);
          this.transport.receiveMessage({
            jsonrpc: '2.0',
            id: message.id,
            result,
          });
        } catch (error) {
          this.transport.receiveMessage({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32603, message: String(error) },
          });
        }
      }
    });
  }

  private async handleToolCall(params: { name: string; arguments: any }): Promise<any> {
    const { name, arguments: args } = params;
    const tool = tools[name as ToolName];
    if (!tool) throw new Error(`Unknown tool: ${name}`);

    const validatedInput = tool.inputSchema.parse(args);
    const result = await this.executeTool(name as ToolName, validatedInput);

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }

  private async executeTool(name: ToolName, input: any): Promise<any> {
    switch (name) {
      case 'flyToLocation': {
        const location = resolveLocationName(input.locationName);
        if (!location) return { success: false, message: `Unknown location: ${input.locationName}` };
        return this.commandHandler({
          type: 'camera.flyTo',
          destination: { ...location, height: input.height || 500 },
          duration: input.duration || 3,
          screenshot: input.screenshot,
        });
      }
      case 'flyTo':
        return this.commandHandler({
          type: 'camera.flyTo',
          destination: { longitude: input.longitude, latitude: input.latitude, height: input.height || 500 },
          duration: input.duration,
          screenshot: input.screenshot,
        });
      case 'addPoint':
        return this.commandHandler({
          type: 'entity.add',
          entity: czmlGenerator.createPoint({ longitude: input.longitude, latitude: input.latitude }, { name: input.name, color: input.color, pixelSize: input.size }),
        });
      case 'addLabel':
        return this.commandHandler({
          type: 'entity.add',
          entity: czmlGenerator.createLabel({ longitude: input.longitude, latitude: input.latitude }, input.text, { fillColor: input.color }),
        });
      case 'removeEntity':
        return this.commandHandler({ type: 'entity.remove', id: input.id });
      case 'clearAll':
        return { success: true, message: 'Clear all requested', data: { action: 'clearAll' } };
      case 'setSceneMode':
        return this.commandHandler({ type: 'scene.mode', mode: input.mode });
      case 'loadCourseware': {
        const groups = this.coursewareManager.getGroups();
        const czml = czmlGenerator.convertGroupsToCZML(groups);
        return this.commandHandler({
          type: 'data.loadCZML',
          czml: czml,
        });
      }
      case 'addCoursewareDrawing': {
        const drawing: GeographyDrawing = {
          name: input.name,
          region: {
            large: input.largeRegion || "Current View",
            small: input.smallRegion || "Manual Plot"
          },
          position: {
            longitude: input.longitude,
            latitude: input.latitude,
            height: 0
          },
          label: input.label,
          associations: input.associations || [],
          style: {
            color: input.color || "red",
            pointSize: input.size || 10
          }
        };
        this.coursewareManager.addDrawing(input.groupName, drawing);
        return this.executeTool('loadCourseware', {});
      }
      case 'removeCoursewareItem': {
        let success = false;
        let message = "";

        if (input.level === 'group') {
          success = this.coursewareManager.removeGroup(input.groupName);
          message = success ? `Group ${input.groupName} removed.` : `Group ${input.groupName} not found.`;
        } else if (input.level === 'point') {
          const count = this.coursewareManager.removeDrawings(input.groupName, input.pointNames || []);
          success = count > 0;
          message = `Removed ${count} points from group ${input.groupName}.`;
        } else if (input.level === 'line') {
          if (input.name && input.name.includes('-')) {
            const [nameA, nameB] = input.name.split('-');
            success = this.coursewareManager.removeAssociation(input.groupName, nameA, nameB);
            message = success ? `Line ${input.name} removed from group ${input.groupName}.` : `Line ${input.name} not found.`;
          } else {
            message = "Invalid line format. Use 'NameA-NameB'.";
          }
        }

        if (success) {
          return this.executeTool('loadCourseware', {});
        }
        return { success, message };
      }
      default:
        throw new Error(`Tool not implemented: ${name}`);
    }
  }

  getToolDefinitions() {
    return Object.values(tools).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema, // Simplified for this version
    }));
  }
}