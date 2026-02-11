/**
 * CZML Generator - Creates CZML documents from structured commands
 */

import type {
  CZMLDocumentArray,
  CZMLDocument,
  CZMLPacket,
  CZMLColor,
  CZMLMaterial,
  CartographicPosition,
} from './types';

let entityCounter = 0;

function generateId(prefix: string = 'entity'): string {
  return `${prefix}_${++entityCounter}_${Date.now()}`;
}

export function createCZMLDocument(
  name: string = 'Generated CZML',
  options?: {
    startTime?: string;
    stopTime?: string;
    currentTime?: string;
    multiplier?: number;
  }
): CZMLDocument {
  const doc: CZMLDocument = {
    id: 'document',
    name,
    version: '1.0',
  };

  if (options?.startTime || options?.stopTime) {
    doc.clock = {
      interval: `${options.startTime || ''}/${options.stopTime || ''}`,
      currentTime: options.currentTime,
      multiplier: options.multiplier || 1,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER',
    };
  }

  return doc;
}

export function positionToCartographicDegrees(pos: CartographicPosition): number[] {
  return [pos.longitude, pos.latitude, pos.height || 0];
}

export function createColor(
  r: number,
  g: number,
  b: number,
  a: number = 255
): CZMLColor {
  return { rgba: [r, g, b, a] };
}

export function createColorFromName(colorName: string): CZMLColor {
  const colors: Record<string, number[]> = {
    red: [255, 0, 0, 255],
    green: [0, 255, 0, 255],
    blue: [0, 0, 255, 255],
    yellow: [255, 255, 0, 255],
    orange: [255, 165, 0, 255],
    purple: [128, 0, 128, 255],
    pink: [255, 192, 203, 255],
    cyan: [0, 255, 255, 255],
    white: [255, 255, 255, 255],
    black: [0, 0, 0, 255],
    gray: [128, 128, 128, 255],
    grey: [128, 128, 128, 255],
  };

  const rgba = colors[colorName.toLowerCase()] || colors['red'];
  return { rgba: rgba as [number, number, number, number] };
}

export function createSolidColorMaterial(color: CZMLColor): CZMLMaterial {
  return { solidColor: { color } };
}

export function createPoint(
  position: CartographicPosition,
  options?: {
    id?: string;
    name?: string;
    color?: string;
    pixelSize?: number;
    outlineColor?: string;
    outlineWidth?: number;
  }
): CZMLPacket {
  return {
    id: options?.id || generateId('point'),
    name: options?.name || 'Point',
    position: {
      cartographicDegrees: positionToCartographicDegrees(position),
    },
    point: {
      color: createColorFromName(options?.color || 'red'),
      pixelSize: options?.pixelSize || 10,
      outlineColor: options?.outlineColor
        ? createColorFromName(options.outlineColor)
        : createColorFromName('white'),
      outlineWidth: options?.outlineWidth || 2,
      show: true,
      heightReference: 'RELATIVE_TO_GROUND',
    },
  };
}

export function createLabel(
  position: CartographicPosition,
  text: string,
  options?: {
    id?: string;
    font?: string;
    fillColor?: string;
    scale?: number;
    pixelOffset?: [number, number];
  }
): CZMLPacket {
  return {
    id: options?.id || generateId('label'),
    name: text,
    position: {
      cartographicDegrees: positionToCartographicDegrees(position),
    },
    label: {
      text,
      font: options?.font || '14pt sans-serif',
      fillColor: createColorFromName(options?.fillColor || 'white'),
      scale: options?.scale || 1,
      show: true,
      horizontalOrigin: 'CENTER',
      verticalOrigin: 'BOTTOM',
      pixelOffset: options?.pixelOffset
        ? { cartesian2: options.pixelOffset }
        : { cartesian2: [0, -20] },
      heightReference: 'RELATIVE_TO_GROUND',
    },
  };
}

export function createPolyline(
  positions: CartographicPosition[],
  options?: {
    id?: string;
    name?: string;
    color?: string;
    width?: number;
    clampToGround?: boolean;
    material?: CZMLMaterial;
  }
): CZMLPacket {
  const coords: number[] = [];
  for (const pos of positions) {
    coords.push(pos.longitude, pos.latitude, pos.height || 0);
  }

  return {
    id: options?.id || generateId('polyline'),
    name: options?.name || 'Polyline',
    polyline: {
      positions: { cartographicDegrees: coords },
      width: options?.width || 3,
      material: options?.material || createSolidColorMaterial(
        createColorFromName(options?.color || 'blue')
      ),
      clampToGround: options?.clampToGround ?? false,
      show: true,
    },
  };
}

export function createPolygon(
  positions: CartographicPosition[],
  options?: {
    id?: string;
    name?: string;
    color?: string;
    height?: number;
    extrudedHeight?: number;
    outline?: boolean;
    outlineColor?: string;
  }
): CZMLPacket {
  const coords: number[] = [];
  for (const pos of positions) {
    coords.push(pos.longitude, pos.latitude, pos.height || 0);
  }

  return {
    id: options?.id || generateId('polygon'),
    name: options?.name || 'Polygon',
    polygon: {
      positions: { cartographicDegrees: coords },
      height: options?.height || 0,
      extrudedHeight: options?.extrudedHeight,
      material: createSolidColorMaterial(
        createColorFromName(options?.color || 'blue')
      ),
      outline: options?.outline ?? true,
      outlineColor: createColorFromName(options?.outlineColor || 'white'),
      show: true,
    },
  };
}

export function createEllipse(
  position: CartographicPosition,
  semiMajorAxis: number,
  semiMinorAxis: number,
  options?: {
    id?: string;
    name?: string;
    color?: string;
    height?: number;
    extrudedHeight?: number;
    rotation?: number;
  }
): CZMLPacket {
  return {
    id: options?.id || generateId('ellipse'),
    name: options?.name || 'Ellipse',
    position: {
      cartographicDegrees: positionToCartographicDegrees(position),
    },
    ellipse: {
      semiMajorAxis,
      semiMinorAxis,
      height: options?.height || 0,
      extrudedHeight: options?.extrudedHeight,
      rotation: options?.rotation || 0,
      material: createSolidColorMaterial(
        createColorFromName(options?.color || 'blue')
      ),
      outline: true,
      outlineColor: createColorFromName('white'),
      show: true,
    },
  };
}

export function createCircle(
  position: CartographicPosition,
  radius: number,
  options?: {
    id?: string;
    name?: string;
    color?: string;
    height?: number;
    extrudedHeight?: number;
  }
): CZMLPacket {
  return createEllipse(position, radius, radius, options);
}

export function createBox(
  position: CartographicPosition,
  dimensions: { x: number; y: number; z: number },
  options?: {
    id?: string;
    name?: string;
    color?: string;
  }
): CZMLPacket {
  return {
    id: options?.id || generateId('box'),
    name: options?.name || 'Box',
    position: {
      cartographicDegrees: positionToCartographicDegrees(position),
    },
    box: {
      dimensions: { cartesian: [dimensions.x, dimensions.y, dimensions.z] },
      material: createSolidColorMaterial(
        createColorFromName(options?.color || 'blue')
      ),
      outline: true,
      outlineColor: createColorFromName('white'),
      show: true,
    },
  };
}

export function createSphere(
  position: CartographicPosition,
  radius: number,
  options?: {
    id?: string;
    name?: string;
    color?: string;
    fill?: boolean;
    outline?: boolean;
    outlineColor?: string;
  }
): CZMLPacket {
  return {
    id: options?.id || generateId('ellipsoid'),
    name: options?.name || 'Sphere',
    position: {
      cartographicDegrees: positionToCartographicDegrees(position),
    },
    ellipsoid: {
      radii: { cartesian: [radius, radius, radius] },
      fill: options?.fill ?? true,
      material: createSolidColorMaterial(
        createColorFromName(options?.color || 'blue')
      ),
      outline: options?.outline ?? true,
      outlineColor: createColorFromName(options?.outlineColor || 'white'),
      show: true,
    },
  };
}

export function buildCZMLDocument(
  entities: CZMLPacket[],
  documentOptions?: {
    name?: string;
    startTime?: string;
    stopTime?: string;
    currentTime?: string;
    multiplier?: number;
  }
): CZMLDocumentArray {
  const doc = createCZMLDocument(documentOptions?.name, documentOptions);
  return [doc, ...entities] as CZMLDocumentArray;
}

/**
 * Converts Geography Courseware groups into CZML packets
 */
export function convertGroupsToCZML(groups: any[]): CZMLDocumentArray {
  const packets: CZMLPacket[] = [];
  
  for (const group of groups) {
    const drawingMap = new Map<string, any>();
    const adj = new Map<string, string[]>();
    const groupPrefix = group.name + "_";
    
    group.drawings.forEach((d: any) => {
      drawingMap.set(d.name, d);
      adj.set(d.name, []);
    });

    // 1. 建立邻接表
    group.drawings.forEach((d: any) => {
      if (d.associations) {
        d.associations.forEach((targetName: string) => {
          if (drawingMap.has(targetName)) {
            adj.get(d.name)!.push(targetName);
            adj.get(targetName)!.push(d.name);
          }
        });
      }
    });

    // 2. 棋子着色逻辑 (BFS)
    const colors = new Map<string, string>();
    const visited = new Set<string>();
    group.drawings.forEach((d: any) => {
      if (visited.has(d.name)) return;
      const neighbors = adj.get(d.name);
      if (!neighbors || neighbors.length === 0) {
        colors.set(d.name, 'yinyang');
        visited.add(d.name);
        return;
      }
      const queue: [string, string][] = [[d.name, 'black']];
      visited.add(d.name);
      while (queue.length > 0) {
        const [curr, color] = queue.shift()!;
        colors.set(curr, color);
        const nextColor = color === 'black' ? 'white' : 'black';
        adj.get(curr)!.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([neighbor, nextColor]);
          }
        });
      }
    });

    const qiziMap: Record<string, string> = {
      'yinyang': '/assets/qizi/阴阳.png',
      'black': '/assets/qizi/黑.png',
      'white': '/assets/qizi/白.png'
    };

    // 3. First pass: Create billboards and labels for this group
    for (const drawing of group.drawings) {
      const entityId = groupPrefix + drawing.name;
      const qiziType = colors.get(drawing.name) || 'yinyang';

      // 灵气/雾气特效：使用第二个 Billboard 实现渐变仙气感
      // 这种方式可以像标绘点一样在任何高度可见，并支持 disableDepthTestDistance
      // mistImage 是一个径向渐变的 SVG
      const mistPacket: CZMLPacket = {
        id: `${entityId}_mist`,
        name: `${drawing.name}_雾气`,
        position: {
          cartographicDegrees: [drawing.position.longitude, drawing.position.latitude, 500],
        },
        billboard: {
          image: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImdyYWQiIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjUwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6d2hpdGU7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjp3aGl0ZTtzdG9wLW9wYWNpdHk6MCIgLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI2NCIgZmlsbD0idXJsKCNncmFkKSIgLz48L3N2Zz4=",
          width: 32, // 缩小范围
          height: 32,
          color: { rgba: [255, 223, 0, 120] }, // 金色渐变雾气
          heightReference: 'RELATIVE_TO_GROUND',
          verticalOrigin: 'CENTER',
          disableDepthTestDistance: 10000, // 恢复遮挡
          eyeOffset: { cartesian: [0, 0, 10] } // 稍微推后，确保在棋子下方
        }
      };
      packets.push(mistPacket);
      
      const packet: CZMLPacket = {
        id: entityId,
        name: drawing.name,
        position: {
          cartographicDegrees: [drawing.position.longitude, drawing.position.latitude, 500],
        },
        billboard: {
          image: qiziMap[qiziType],
          width: 24,
          height: 24,
          heightReference: 'RELATIVE_TO_GROUND',
          verticalOrigin: 'CENTER',
          disableDepthTestDistance: 10000 // 恢复遮挡
        },
        label: {
          text: drawing.name,
          font: '14pt sans-serif',
          fillColor: { rgba: [255, 255, 255, 255] },
          outlineColor: { rgba: [0, 0, 0, 255] },
          outlineWidth: 2,
          style: 'FILL_AND_OUTLINE',
          pixelOffset: { cartesian2: [0, -40] },
          horizontalOrigin: 'CENTER',
          verticalOrigin: 'BOTTOM',
          show: true,
          heightReference: 'RELATIVE_To_GROUND' as any, // 兼容性处理
          disableDepthTestDistance: 10000 // 缩小深度测试禁用距离，防止在地球背面可见
        },
        description: `Group: ${group.name}\n${drawing.label || ""}`
      };
      packets.push(packet);
    }

    // 2. Second pass: Create association lines within this group
    for (const drawing of group.drawings) {
      if (drawing.associations && drawing.associations.length > 0) {
        for (const targetName of drawing.associations) {
          const target = drawingMap.get(targetName);
          if (target) {
            packets.push(createPolyline(
              [drawing.position, target.position],
              {
                id: `link_${groupPrefix}${drawing.name}_${targetName}`,
                name: `Link: ${drawing.name} to ${targetName} (${group.name})`,
                width: 3,
                material: {
                  polylineGlow: {
                    color: { rgba: [255, 223, 0, 255] }, // 亮金色
                    glowPower: 0.3
                  }
                },
                clampToGround: true
              }
            ));
          }
        }
      }
    }
  }

  return buildCZMLDocument(packets, { name: 'Geography Courseware' });
}
