/**
 * CesiumJS Command Types and CZML Schema Definitions
 */

// Geographic position types
export interface CartographicPosition {
  longitude: number;  // degrees
  latitude: number;   // degrees
  height?: number;    // meters
}

export interface Cartesian3Position {
  x: number;
  y: number;
  z: number;
}

export type Position = CartographicPosition | Cartesian3Position;

// Camera control commands
export interface CameraFlyToCommand {
  type: 'camera.flyTo';
  destination: CartographicPosition;
  orientation?: {
    heading?: number;  // radians
    pitch?: number;    // radians
    roll?: number;     // radians
  };
  duration?: number;   // seconds
  screenshot?: boolean;
}

export interface CameraLookAtCommand {
  type: 'camera.lookAt';
  target: CartographicPosition;
  offset?: {
    heading: number;
    pitch: number;
    range: number;
  };
}

export interface CameraZoomCommand {
  type: 'camera.zoom';
  amount: number;  // positive = zoom in, negative = zoom out
}

export interface CameraRotateCommand {
  type: 'camera.rotate';
  heading?: number;
  pitch?: number;
  roll?: number;
}

export interface CameraOrbitCommand {
  type: 'camera.orbit';
  target: CartographicPosition;
  duration: number;            // seconds
  headingDelta?: number;       // How much to rotate in radians (default: 2*PI for full orbit)
  pitchDelta?: number;         // Change in pitch during orbit (radians)
}

export interface CameraTrackCommand {
  type: 'camera.track';
  entityId: string;
  offset?: {
    heading: number;
    pitch: number;
    range: number;
  };
}

export interface CameraCinematicFlightCommand {
  type: 'camera.cinematicFlight';
  waypoints: Array<{
    position: CartographicPosition;
    duration?: number;         // Duration to reach this waypoint (seconds)
    orientation?: {
      heading?: number;
      pitch?: number;
      roll?: number;
    };
  }>;
  loop?: boolean;              // Whether to loop back to the first waypoint
}

export interface FlyToEntityCommand {
  type: 'entity.flyTo';
  entityId: string;
  duration?: number;           // Flight duration in seconds
  offset?: {
    heading?: number;          // radians
    pitch?: number;            // radians
    range?: number;            // meters from entity
  };
}

export interface ShowEntityCommand {
  type: 'entity.show';
  entityId: string;
}

export interface HideEntityCommand {
  type: 'entity.hide';
  entityId: string;
}

// Entity commands
export interface AddEntityCommand {
  type: 'entity.add';
  entity: CZMLEntity;
}

export interface RemoveEntityCommand {
  type: 'entity.remove';
  id: string;
}

export interface UpdateEntityCommand {
  type: 'entity.update';
  id: string;
  properties: Partial<CZMLEntity>;
}

export interface CloneEntityCommand {
  type: 'entity.clone';
  entityId: string;
  newName: string;
}

// Layer commands
export interface AddImageryCommand {
  type: 'imagery.add';
  provider: 'bing' | 'osm' | 'arcgis' | 'tms' | 'wms';
  url?: string;
  options?: Record<string, unknown>;
}

export interface ToggleLayerCommand {
  type: 'layer.toggle';
  layerId: string;
  visible: boolean;
}

// Time commands
export interface SetTimeCommand {
  type: 'time.set';
  currentTime?: string;  // ISO 8601
  startTime?: string;
  stopTime?: string;
  multiplier?: number;
}

export interface PlayTimeCommand {
  type: 'time.play';
}

export interface PauseTimeCommand {
  type: 'time.pause';
}

// Scene commands
export interface SetSceneMode {
  type: 'scene.mode';
  mode: '2D' | '3D' | 'COLUMBUS_VIEW';
}

export interface SetTerrainCommand {
  type: 'terrain.set';
  provider: 'cesium' | 'ellipsoid' | 'custom';
  url?: string;
  assetId?: number;
}

// 3D Tiles commands
export interface Add3DTilesCommand {
  type: 'tiles3d.add';
  id: string;
  url: string;
  assetId?: number;
  maximumScreenSpaceError?: number;
  maximumMemoryUsage?: number;
  show?: boolean;
}

export interface Remove3DTilesCommand {
  type: 'tiles3d.remove';
  id: string;
}

export interface Style3DTilesCommand {
  type: 'tiles3d.style';
  id: string;
  style: Cesium3DTileStyle;
}

export interface Cesium3DTileStyle {
  color?: string | object;
  show?: string | boolean;
  pointSize?: string | number;
  meta?: Record<string, string>;
}

export interface SetTerrainExaggerationCommand {
  type: 'terrain.exaggeration';
  factor: number;
  relativeHeight?: number;
}

export interface CameraSetViewCommand {
  type: 'camera.setView';
  destination: CartographicPosition;
  orientation?: {
    heading?: number;
    pitch?: number;
    roll?: number;
  };
}

export interface CameraGetCommand {
  type: 'camera.get';
}

export interface SelectEntityCommand {
  type: 'entity.select';
  entityId: string;
}

export interface ListEntitiesCommand {
  type: 'entity.list';
}

export interface GetEntityInfoCommand {
  type: 'entity.getInfo';
  entityId: string;
}

export interface LoadGeoJSONCommand {
  type: 'data.loadGeoJSON';
  url: string;
  name?: string;
  clampToGround?: boolean;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}

export interface LoadCZMLCommand {
  type: 'data.loadCZML';
  czml: CZMLDocumentArray;
}

// Aggregate command type
export interface RemoveImageryCommand {
  type: 'imagery.remove';
  index: number;
}

export type CesiumCommand =
  | CameraFlyToCommand
  | CameraLookAtCommand
  | CameraZoomCommand
  | CameraRotateCommand
  | CameraOrbitCommand
  | CameraTrackCommand
  | CameraCinematicFlightCommand
  | CameraSetViewCommand
  | CameraGetCommand
  | AddEntityCommand
  | RemoveEntityCommand
  | UpdateEntityCommand
  | CloneEntityCommand
  | FlyToEntityCommand
  | ShowEntityCommand
  | HideEntityCommand
  | SelectEntityCommand
  | ListEntitiesCommand
  | GetEntityInfoCommand
  | AddImageryCommand
  | RemoveImageryCommand
  | ToggleLayerCommand
  | SetTimeCommand
  | PlayTimeCommand
  | PauseTimeCommand
  | SetSceneMode
  | SetTerrainCommand
  | Add3DTilesCommand
  | Remove3DTilesCommand
  | Style3DTilesCommand
  | SetTerrainExaggerationCommand
  | LoadGeoJSONCommand
  | LoadCZMLCommand;

// CZML Types
export interface CZMLPacket {
  id: string;
  name?: string;
  description?: string;
  availability?: string;
  position?: CZMLPosition;
  orientation?: CZMLOrientation;
  billboard?: CZMLBillboard;
  label?: CZMLLabel;
  point?: CZMLPoint;
  polyline?: CZMLPolyline;
  polygon?: CZMLPolygon;
  ellipse?: CZMLEllipse;
  ellipsoid?: CZMLEllipsoid;
  box?: CZMLBox;
  cylinder?: CZMLCylinder;
  corridor?: CZMLCorridor;
  rectangle?: CZMLRectangle;
  wall?: CZMLWall;
  polylineVolume?: CZMLPolylineVolume;
  model?: CZMLModel;
  path?: CZMLPath;
}

export interface CZMLDocument extends CZMLPacket {
  id: 'document';
  version: '1.0';
  clock?: CZMLClock;
}

export interface CZMLClock {
  interval?: string;
  currentTime?: string;
  multiplier?: number;
  range?: 'UNBOUNDED' | 'CLAMPED' | 'LOOP_STOP';
  step?: 'SYSTEM_CLOCK' | 'SYSTEM_CLOCK_MULTIPLIER' | 'TICK_DEPENDENT';
}

export interface CZMLPosition {
  cartographicDegrees?: number[] | (string | number)[];
  cartesian?: number[] | (string | number)[];
  epoch?: string;
  interpolationAlgorithm?: 'LINEAR' | 'LAGRANGE' | 'HERMITE';
  interpolationDegree?: number;
  referenceFrame?: 'FIXED' | 'INERTIAL';
}

export interface CZMLOrientation {
  unitQuaternion?: number[];
  velocityReference?: string;
}

export interface CZMLBillboard {
  image: string | { uri: string };
  scale?: number;
  width?: number;
  height?: number;
  show?: boolean;
  color?: CZMLColor;
  horizontalOrigin?: 'LEFT' | 'CENTER' | 'RIGHT';
  verticalOrigin?: 'TOP' | 'CENTER' | 'BOTTOM' | 'BASELINE';
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
  disableDepthTestDistance?: number;
  eyeOffset?: { cartesian: number[] };
}

export interface CZMLLabel {
  text: string;
  font?: string;
  style?: 'FILL' | 'OUTLINE' | 'FILL_AND_OUTLINE';
  scale?: number;
  show?: boolean;
  fillColor?: CZMLColor;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  horizontalOrigin?: 'LEFT' | 'CENTER' | 'RIGHT';
  verticalOrigin?: 'TOP' | 'CENTER' | 'BOTTOM' | 'BASELINE';
  pixelOffset?: { cartesian2: number[] };
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
  disableDepthTestDistance?: number;
}

export interface CZMLPoint {
  color?: CZMLColor;
  pixelSize?: number;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
  disableDepthTestDistance?: number;
}

export interface CZMLPolyline {
  positions: CZMLPosition;
  width?: number;
  material?: CZMLMaterial;
  clampToGround?: boolean;
  show?: boolean;
}

export interface CZMLPolygon {
  positions: CZMLPosition;
  height?: number;
  extrudedHeight?: number;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  show?: boolean;
}

export interface CZMLEllipse {
  semiMajorAxis: number;
  semiMinorAxis: number;
  height?: number;
  extrudedHeight?: number;
  rotation?: number;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
}

export interface CZMLBox {
  dimensions: { cartesian: number[] };
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  show?: boolean;
}

export interface CZMLModel {
  gltf: string;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  show?: boolean;
}

export interface CZMLPath {
  show?: boolean;
  width?: number;
  material?: CZMLMaterial;
  resolution?: number;
  leadTime?: number;
  trailTime?: number;
}

export interface CZMLEllipsoid {
  radii: { cartesian: number[] };
  innerRadii?: { cartesian: number[] };
  minimumClock?: number;
  maximumClock?: number;
  minimumCone?: number;
  maximumCone?: number;
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  stackPartitions?: number;
  slicePartitions?: number;
  subdivisions?: number;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
}

export interface CZMLCylinder {
  length: number;
  topRadius: number;
  bottomRadius: number;
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  numberOfVerticalLines?: number;
  slices?: number;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
}

export interface CZMLCorridor {
  positions: CZMLPosition;
  width: number;
  height?: number;
  extrudedHeight?: number;
  cornerType?: 'ROUNDED' | 'MITERED' | 'BEVELED';
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
}

export interface CZMLRectangle {
  coordinates: { wsenDegrees: number[] };
  height?: number;
  extrudedHeight?: number;
  rotation?: number;
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  show?: boolean;
  heightReference?: 'NONE' | 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND';
}

export interface CZMLWall {
  positions: CZMLPosition;
  minimumHeights?: number[];
  maximumHeights?: number[];
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  show?: boolean;
}

export interface CZMLPolylineVolume {
  positions: CZMLPosition;
  shape: { cartesian2: number[] };
  cornerType?: 'ROUNDED' | 'MITERED' | 'BEVELED';
  fill?: boolean;
  material?: CZMLMaterial;
  outline?: boolean;
  outlineColor?: CZMLColor;
  outlineWidth?: number;
  show?: boolean;
}

export interface CZMLColor {
  rgba?: number[];
  rgbaf?: number[];
}

export interface CZMLMaterial {
  solidColor?: { color: CZMLColor };
  polylineOutline?: {
    color: CZMLColor;
    outlineColor: CZMLColor;
    outlineWidth: number;
  };
  polylineGlow?: {
    color: CZMLColor;
    glowPower: number;
  };
  polylineArrow?: { color: CZMLColor };
  polylineDash?: {
    color: CZMLColor;
    dashLength?: number;
    dashPattern?: number;
  };
  image?: {
    image: string | { uri: string };
    repeat?: { cartesian2: number[] };
  };
}

export type CZMLEntity = CZMLPacket;
export type CZMLDocumentArray = [CZMLDocument, ...CZMLPacket[]];

// Geography Teaching Drawing Types
export interface GeographyDrawing {
  name: string;
  region: {
    large: string;
    small: string;
  };
  position: CartographicPosition;
  label?: string;
  associations?: string[]; // Names of other drawings to connect to with a line
  style?: {
    color?: string;
    pointSize?: number;
  };
}

export interface GeographyGroup {
  name: string;
  drawings: GeographyDrawing[];
}

export interface GeographyCourseware {
  version: string;
  coursewareName: string;
  groups: GeographyGroup[];
}