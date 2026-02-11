/**
 * CesiumJS Command Executor
 * Executes commands against a CesiumJS Viewer instance
 */

import type { CesiumCommand, CZMLDocumentArray } from './types';

// Type definitions for CesiumJS
interface CesiumViewer {
  camera: any;
  scene: any;
  clock: any;
  dataSources: any;
  entities: any;
  imageryLayers: any;
  terrainProvider: any;
  zoomTo: (target: any, offset?: any) => Promise<boolean>;
  flyTo: (target: any, options?: any) => Promise<boolean>;
  selectedEntity?: any;
}

declare const Cesium: any;

export class CesiumCommandExecutor {
  private viewer: CesiumViewer;
  private loadedDataSources: Map<string, any> = new Map();
  private loadedTilesets: Map<string, any> = new Map();

  constructor(viewer: CesiumViewer) {
    this.viewer = viewer;
  }

  async execute(command: CesiumCommand): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      switch (command.type) {
        case 'camera.flyTo':
          return this.executeCameraFlyTo(command);
        case 'camera.lookAt':
          return this.executeCameraLookAt(command);
        case 'camera.zoom':
          return this.executeCameraZoom(command);
        case 'camera.rotate':
          return this.executeCameraRotate(command);
        case 'entity.add':
          return await this.executeEntityAdd(command);
        case 'entity.remove':
          return this.executeEntityRemove(command);
        case 'entity.update':
          return await this.executeEntityUpdate(command);
        case 'entity.clone':
          return await this.executeEntityClone(command);
        case 'entity.flyTo':
          return await this.executeFlyToEntity(command);
        case 'entity.show':
          return this.executeShowEntity(command);
        case 'entity.hide':
          return this.executeHideEntity(command);
        case 'imagery.add':
          return await this.executeImageryAdd(command);
        case 'time.set':
          return this.executeTimeSet(command);
        case 'time.play':
          return this.executeTimePlay();
        case 'time.pause':
          return this.executeTimePause();
        case 'scene.mode':
          return this.executeSceneMode(command);
        case 'terrain.set':
          return await this.executeTerrainSet(command);
        case 'terrain.exaggeration':
          return this.executeTerrainExaggeration(command);
        case 'tiles3d.add':
          return await this.execute3DTilesAdd(command);
        case 'tiles3d.remove':
          return this.execute3DTilesRemove(command);
        case 'tiles3d.style':
          return this.execute3DTilesStyle(command);
        case 'camera.setView':
          return this.executeCameraSetView(command);
        case 'camera.get':
          return this.executeCameraGet();
        case 'entity.select':
          return this.executeSelectEntity(command);
        case 'entity.list':
          return this.executeListEntities();
        case 'entity.getInfo':
          return this.executeGetEntityInfo(command);
        case 'data.loadGeoJSON':
          return await this.executeLoadGeoJSON(command);
        case 'data.loadCZML':
          return await this.executeLoadCZML(command);
        default:
          return { success: false, message: `Unknown command type: ${(command as any).type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Command execution failed: ${errorMessage}` };
    }
  }

  private async executeCameraFlyTo(command: any): Promise<{ success: boolean; message: string; data?: any }> {
    const destination = Cesium.Cartesian3.fromDegrees(
      command.destination.longitude,
      command.destination.latitude,
      command.destination.height || 1000000
    );

    const orientation = command.orientation
      ? {
          heading: command.orientation.heading ?? 0,
          pitch: command.orientation.pitch ?? Cesium.Math.toRadians(-90),
          roll: command.orientation.roll ?? 0,
        }
      : undefined;

    return new Promise((resolve) => {
      this.viewer.camera.flyTo({
        destination,
        orientation,
        duration: command.duration ?? 3,
        complete: async () => {
          let screenshotData = null;
          if (command.screenshot) {
            // 等待渲染完成
            await this.waitForRender();
            // 截图
            const canvas = this.viewer.scene.canvas;
            screenshotData = canvas.toDataURL('image/jpeg', 0.9);
          }

          resolve({
            success: true,
            message: `Flew to ${command.destination.latitude}, ${command.destination.longitude}${command.screenshot ? ' and captured screenshot' : ''}`,
            data: screenshotData ? { screenshot: screenshotData } : undefined
          });
        },
        cancel: () => {
          resolve({ success: false, message: 'Camera flight was cancelled' });
        }
      });
    });
  }

  private async waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      const removeListener = this.viewer.scene.postRender.addEventListener(() => {
        if (this.viewer.scene.globe.tilesLoaded) {
          removeListener();
          // 额外延迟一帧确保渲染队列清空
          setTimeout(resolve, 100);
        }
      });
    });
  }

  private executeCameraLookAt(command: any): { success: boolean; message: string } {
    const target = Cesium.Cartesian3.fromDegrees(
      command.target.longitude,
      command.target.latitude,
      command.target.height || 0
    );

    const offset = command.offset
      ? new Cesium.HeadingPitchRange(
          command.offset.heading,
          command.offset.pitch,
          command.offset.range
        )
      : new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 1000000);

    this.viewer.camera.lookAt(target, offset);

    return {
      success: true,
      message: `Looking at ${command.target.latitude}, ${command.target.longitude}`,
    };
  }

  private executeCameraZoom(command: any): { success: boolean; message: string } {
    if (command.amount > 0) {
      this.viewer.camera.zoomIn(Math.abs(command.amount));
    } else {
      this.viewer.camera.zoomOut(Math.abs(command.amount));
    }

    return {
      success: true,
      message: `Zoomed ${command.amount > 0 ? 'in' : 'out'} by ${Math.abs(command.amount)}`,
    };
  }

  private executeCameraRotate(command: any): { success: boolean; message: string } {
    this.viewer.camera.setView({
      orientation: {
        heading: command.heading ?? this.viewer.camera.heading,
        pitch: command.pitch ?? this.viewer.camera.pitch,
        roll: command.roll ?? this.viewer.camera.roll,
      },
    });

    return { success: true, message: 'Camera rotated' };
  }

  private async executeEntityAdd(command: any): Promise<{ success: boolean; message: string; data?: any }> {
    const czml: CZMLDocumentArray = [
      { id: 'document', name: 'Entity', version: '1.0' },
      command.entity,
    ];

    const dataSource = await Cesium.CzmlDataSource.load(czml);
    await this.viewer.dataSources.add(dataSource);
    this.loadedDataSources.set(command.entity.id, dataSource);

    return {
      success: true,
      message: `Entity '${command.entity.id}' added`,
      data: { id: command.entity.id },
    };
  }

  private executeEntityRemove(command: any): { success: boolean; message: string } {
    const dataSource = this.loadedDataSources.get(command.id);
    if (dataSource) {
      this.viewer.dataSources.remove(dataSource, true);
      this.loadedDataSources.delete(command.id);
      return { success: true, message: `Entity '${command.id}' removed` };
    }

    const removed = this.viewer.entities.removeById(command.id);
    if (removed) {
      return { success: true, message: `Entity '${command.id}' removed` };
    }

    return { success: false, message: `Entity '${command.id}' not found` };
  }

  private async executeEntityUpdate(command: any): Promise<{ success: boolean; message: string }> {
    const entity = this.findEntityByIdOrName(command.id);
    if (!entity) {
      return { success: false, message: `Entity '${command.id}' not found` };
    }

    const props = command.properties;
    if (props.name !== undefined) entity.name = props.name;
    if (props.description !== undefined) entity.description = props.description;
    if (props.show !== undefined) entity.show = props.show;

    return { success: true, message: `Entity '${command.id}' updated` };
  }

  private async executeEntityClone(command: any): Promise<{ success: boolean; message: string }> {
    const sourceEntity = this.findEntityByIdOrName(command.entityId);
    if (!sourceEntity) {
      return { success: false, message: `Source entity '${command.entityId}' not found` };
    }

    const newId = `${command.newName}_${Date.now()}`;
    this.viewer.entities.add({
      id: newId,
      name: command.newName,
      position: sourceEntity.position?.getValue(Cesium.JulianDate.now()),
      // Simplified cloning
    });

    return { success: true, message: `Entity cloned as '${command.newName}' with ID '${newId}'` };
  }

  private async executeFlyToEntity(command: any): Promise<{ success: boolean; message: string }> {
    let entity = this.findEntityByIdOrName(command.entityId);
    if (!entity) {
      return { success: false, message: `Entity '${command.entityId}' not found` };
    }

    let offset = undefined;
    if (command.offset) {
      offset = new Cesium.HeadingPitchRange(
        command.offset.heading ?? 0,
        command.offset.pitch ?? -Math.PI / 4,
        command.offset.range ?? 10000
      );
    }

    try {
      await this.viewer.flyTo(entity, {
        duration: command.duration ?? 3,
        offset,
      });
      return { success: true, message: `Camera flew to entity '${command.entityId}'` };
    } catch (error) {
      return { success: false, message: `Failed to fly to entity: ${error}` };
    }
  }

  private executeShowEntity(command: any): { success: boolean; message: string } {
    const entity = this.findEntityByIdOrName(command.entityId);
    if (!entity) return { success: false, message: `Entity '${command.entityId}' not found` };
    entity.show = true;
    return { success: true, message: `Entity '${command.entityId}' is now visible` };
  }

  private executeHideEntity(command: any): { success: boolean; message: string } {
    const entity = this.findEntityByIdOrName(command.entityId);
    if (!entity) return { success: false, message: `Entity '${command.entityId}' not found` };
    entity.show = false;
    return { success: true, message: `Entity '${command.entityId}' is now hidden` };
  }

  private findEntityByIdOrName(idOrName: string): any {
    let entity = this.viewer.entities.getById(idOrName);
    if (entity) return entity;

    for (const e of this.viewer.entities.values) {
      if (e.name === idOrName) return e;
    }

    for (let i = 0; i < this.viewer.dataSources.length; i++) {
      const dataSource = this.viewer.dataSources.get(i);
      if (dataSource.entities) {
        entity = dataSource.entities.getById(idOrName);
        if (entity) return entity;
        for (const e of dataSource.entities.values) {
          if (e.name === idOrName) return e;
        }
      }
    }
    return undefined;
  }

  private async executeImageryAdd(command: any): Promise<{ success: boolean; message: string }> {
    let provider: any;
    switch (command.provider) {
      case 'bing': provider = new Cesium.IonImageryProvider({ assetId: 4 }); break;
      case 'osm': provider = new Cesium.OpenStreetMapImageryProvider({ url: command.url || 'https://tile.openstreetmap.org/' }); break;
      case 'arcgis': provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(command.url || 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'); break;
      default: return { success: false, message: `Unknown imagery provider: ${command.provider}` };
    }
    this.viewer.imageryLayers.addImageryProvider(provider);
    return { success: true, message: `${command.provider} imagery layer added` };
  }

  private executeTimeSet(command: any): { success: boolean; message: string } {
    if (command.currentTime) this.viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(command.currentTime);
    if (command.multiplier !== undefined) this.viewer.clock.multiplier = command.multiplier;
    return { success: true, message: 'Time settings updated' };
  }

  private executeTimePlay(): { success: boolean; message: string } {
    this.viewer.clock.shouldAnimate = true;
    return { success: true, message: 'Animation started' };
  }

  private executeTimePause(): { success: boolean; message: string } {
    this.viewer.clock.shouldAnimate = false;
    return { success: true, message: 'Animation paused' };
  }

  private executeSceneMode(command: any): { success: boolean; message: string } {
    const modeMap: Record<string, number> = {
      '2D': Cesium.SceneMode.SCENE2D,
      '3D': Cesium.SceneMode.SCENE3D,
      'COLUMBUS_VIEW': Cesium.SceneMode.COLUMBUS_VIEW,
    };
    const mode = modeMap[command.mode];
    if (mode !== undefined) {
      this.viewer.scene.mode = mode;
      return { success: true, message: `Scene mode set to ${command.mode}` };
    }
    return { success: false, message: `Unknown scene mode: ${command.mode}` };
  }

  private async executeTerrainSet(command: any): Promise<{ success: boolean; message: string }> {
    try {
      switch (command.provider) {
        case 'cesium': this.viewer.terrainProvider = await Cesium.createWorldTerrainAsync(); break;
        case 'ellipsoid': this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider(); break;
        default: return { success: false, message: `Unknown terrain provider: ${command.provider}` };
      }
      return { success: true, message: `Terrain set to ${command.provider}` };
    } catch (error) {
      return { success: false, message: `Failed to set terrain: ${error}` };
    }
  }

  private executeTerrainExaggeration(command: any): { success: boolean; message: string } {
    this.viewer.scene.globe.terrainExaggeration = command.factor;
    return { success: true, message: `Terrain exaggeration set to ${command.factor}x` };
  }

  private async execute3DTilesAdd(command: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(command.url);
      this.viewer.scene.primitives.add(tileset);
      this.loadedTilesets.set(command.id, tileset);
      return { success: true, message: `3D Tileset '${command.id}' loaded`, data: { id: command.id } };
    } catch (error) {
      return { success: false, message: `Failed to load 3D Tileset: ${error}` };
    }
  }

  private execute3DTilesRemove(command: any): { success: boolean; message: string } {
    const tileset = this.loadedTilesets.get(command.id);
    if (!tileset) return { success: false, message: `Tileset '${command.id}' not found` };
    this.viewer.scene.primitives.remove(tileset);
    this.loadedTilesets.delete(command.id);
    return { success: true, message: `3D Tileset '${command.id}' removed` };
  }

  private execute3DTilesStyle(command: any): { success: boolean; message: string } {
    const tileset = this.loadedTilesets.get(command.id);
    if (!tileset) return { success: false, message: `Tileset '${command.id}' not found` };
    tileset.style = new Cesium.Cesium3DTileStyle(command.style);
    return { success: true, message: `Style applied to tileset '${command.id}'` };
  }

  private executeCameraSetView(command: any): { success: boolean; message: string } {
    const destination = Cesium.Cartesian3.fromDegrees(command.destination.longitude, command.destination.latitude, command.destination.height || 1000000);
    this.viewer.camera.setView({ destination, orientation: command.orientation });
    return { success: true, message: 'Camera view set' };
  }

  private executeCameraGet(): { success: boolean; message: string; data?: any } {
    const cartographic = this.viewer.camera.positionCartographic;
    return {
      success: true,
      message: 'Camera position retrieved',
      data: {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
      },
    };
  }

  private executeSelectEntity(command: any): { success: boolean; message: string } {
    const entity = this.findEntityByIdOrName(command.entityId);
    if (!entity) return { success: false, message: `Entity '${command.entityId}' not found` };
    this.viewer.selectedEntity = entity;
    return { success: true, message: `Entity '${command.entityId}' selected` };
  }

  private executeListEntities(): { success: boolean; message: string; data?: any } {
    const entities: any[] = [];
    for (const entity of this.viewer.entities.values) {
      entities.push({ id: entity.id, name: entity.name });
    }
    return { success: true, message: `Found ${entities.length} entities`, data: { entities } };
  }

  private executeGetEntityInfo(command: any): { success: boolean; message: string; data?: any } {
    const entity = this.findEntityByIdOrName(command.entityId);
    if (!entity) return { success: false, message: `Entity '${command.entityId}' not found` };
    return { success: true, message: 'Entity info retrieved', data: { id: entity.id, name: entity.name } };
  }

  private async executeLoadGeoJSON(command: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const dataSource = await Cesium.GeoJsonDataSource.load(command.url);
      await this.viewer.dataSources.add(dataSource);
      const id = command.name || `geojson_${Date.now()}`;
      this.loadedDataSources.set(id, dataSource);
      return { success: true, message: `GeoJSON loaded from ${command.url}`, data: { id } };
    } catch (error) {
      return { success: false, message: `Failed to load GeoJSON: ${error}` };
    }
  }

  private async executeLoadCZML(command: any): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const dataSource = await Cesium.CzmlDataSource.load(command.czml);
      await this.viewer.dataSources.add(dataSource);
      const id = `czml_${Date.now()}`;
      this.loadedDataSources.set(id, dataSource);
      return { success: true, message: 'CZML loaded successfully', data: { id } };
    } catch (error) {
      return { success: false, message: `Failed to load CZML: ${error}` };
    }
  }

  clearAll(): { success: boolean; message: string } {
    this.viewer.dataSources.removeAll(true);
    this.viewer.entities.removeAll();
    this.loadedDataSources.clear();
    for (const [_id, tileset] of this.loadedTilesets) {
      this.viewer.scene.primitives.remove(tileset);
    }
    this.loadedTilesets.clear();
    return { success: true, message: 'All entities and tilesets cleared' };
  }
}