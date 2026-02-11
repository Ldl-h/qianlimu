import * as fs from 'fs';
import * as path from 'path';
import { GeographyCourseware, GeographyDrawing, GeographyGroup } from './types';

export class CoursewareManager {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(__dirname, 'courseware.json');
  }

  read(): GeographyCourseware {
    if (!fs.existsSync(this.filePath)) {
      return { version: "1.0", coursewareName: "默认教案", groups: [] };
    }
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(content);
      // 兼容旧格式
      if (data.drawings && !data.groups) {
        return {
          version: data.version || "1.0",
          coursewareName: data.coursewareName || "默认教案",
          groups: [{ name: "默认分组", drawings: data.drawings }]
        };
      }
      return data;
    } catch (e) {
      console.error('Error reading courseware:', e);
      return { version: "1.0", coursewareName: "默认教案", groups: [] };
    }
  }

  save(data: GeographyCourseware): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving courseware:', e);
    }
  }

  getOrCreateGroup(courseware: GeographyCourseware, groupName: string): GeographyGroup {
    // 确保组名唯一：查找现有组，如果不存在则创建
    let group = courseware.groups.find(g => g.name === groupName);
    if (!group) {
      group = { name: groupName, drawings: [] };
      courseware.groups.push(group);
    }
    return group;
  }

  addDrawing(groupName: string, drawing: GeographyDrawing): void {
    const courseware = this.read();
    const group = this.getOrCreateGroup(courseware, groupName);
    
    const index = group.drawings.findIndex(d => d.name === drawing.name);
    if (index > -1) {
      group.drawings[index] = drawing;
    } else {
      group.drawings.push(drawing);
    }

    // 实现双向关联：确保被关联的点也关联回当前点
    if (drawing.associations && drawing.associations.length > 0) {
      drawing.associations.forEach(targetName => {
        const targetDrawing = group.drawings.find(d => d.name === targetName);
        if (targetDrawing) {
          // 防御性处理：如果旧数据中 associations 是字符串，强制转为数组
          if (typeof targetDrawing.associations === 'string') {
            targetDrawing.associations = [targetDrawing.associations];
          }
          if (!targetDrawing.associations || !Array.isArray(targetDrawing.associations)) {
            targetDrawing.associations = [];
          }
          if (!targetDrawing.associations.includes(drawing.name)) {
            targetDrawing.associations.push(drawing.name);
          }
        }
      });
    }

    this.save(courseware);
  }

  removeGroup(groupName: string): boolean {
    const courseware = this.read();
    const initialLength = courseware.groups.length;
    courseware.groups = courseware.groups.filter(g => g.name !== groupName);
    if (courseware.groups.length !== initialLength) {
      this.save(courseware);
      return true;
    }
    return false;
  }

  removeDrawings(groupName: string, names: string[]): number {
    const courseware = this.read();
    const group = courseware.groups.find(g => g.name === groupName);
    if (!group) return 0;

    const initialCount = group.drawings.length;
    group.drawings = group.drawings.filter(d => !names.includes(d.name));
    
    // 同时清理其他点对这些被删除点的关联
    group.drawings.forEach(d => {
      if (d.associations) {
        d.associations = d.associations.filter(assoc => !names.includes(assoc));
      }
    });

    const removedCount = initialCount - group.drawings.length;
    if (removedCount > 0) {
      this.save(courseware);
    }
    return removedCount;
  }

  removeAssociation(groupName: string, nameA: string, nameB: string): boolean {
    const courseware = this.read();
    const group = courseware.groups.find(g => g.name === groupName);
    if (!group) return false;

    let changed = false;
    const drawingA = group.drawings.find(d => d.name === nameA);
    if (drawingA && drawingA.associations) {
      const initialLen = drawingA.associations.length;
      drawingA.associations = drawingA.associations.filter(name => name !== nameB);
      if (drawingA.associations.length !== initialLen) changed = true;
    }

    const drawingB = group.drawings.find(d => d.name === nameB);
    if (drawingB && drawingB.associations) {
      const initialLen = drawingB.associations.length;
      drawingB.associations = drawingB.associations.filter(name => name !== nameA);
      if (drawingB.associations.length !== initialLen) changed = true;
    }

    if (changed) {
      this.save(courseware);
    }
    return changed;
  }

  getGroups(): GeographyGroup[] {
    return this.read().groups;
  }

  getGroup(name: string): GeographyGroup | undefined {
    return this.read().groups.find(g => g.name === name);
  }
}