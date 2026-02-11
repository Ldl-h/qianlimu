/**
 * 千里目 VCP 同步插件
 * 功能：管理地理教案持久化、逻辑关联及指令分发
 */

const fs = require('fs');
const path = require('path');

// 更新 UI 状态和教案摘要
function updateUIState(status, courseware = null, loadedGroups = null) {
    const statePath = path.join(__dirname, 'ui-state.json');
    const coursewarePath = process.env.COURSEWARE_PATH || path.join(__dirname, 'courseware.json');
    
    let state = {
        "千里目状态": "未启动",
        "已加载组": [],
        "案台": []
    };

    let oldStateRaw = "";

    // 1. 从磁盘水合现有状态（解决跨进程内存丢失问题）
    if (fs.existsSync(statePath)) {
        try {
            oldStateRaw = fs.readFileSync(statePath, 'utf8');
            const existingState = JSON.parse(oldStateRaw);
            state["千里目状态"] = existingState["千里目状态"] || "未启动";
            state["已加载组"] = existingState["已加载组"] || existingState["场上活跃组"] || [];
            state["案台"] = existingState["案台"] || [];
        } catch (e) {}
    }

    // 2. 如果没有传入 courseware，尝试从磁盘读取最新的（确保案台信息不丢失）
    if (!courseware) {
        courseware = readCourseware(coursewarePath);
    }

    // 3. 更新状态字段
    if (status) state["千里目状态"] = status;

    // 4. 处理活跃组逻辑（使用 Set 确保唯一性）
    let activeSet = new Set(state["已加载组"]);

    if (loadedGroups !== null) {
        if (loadedGroups === "全量教案") {
            if (courseware && courseware.groups) {
                courseware.groups.forEach(g => activeSet.add(g.name));
            }
        } else {
            // 支持数组或逗号分隔的字符串
            const groupsArray = Array.isArray(loadedGroups) ? loadedGroups : loadedGroups.split(',');
            groupsArray.forEach(g => {
                const name = g.trim();
                if (name) activeSet.add(name);
            });
        }
    }

    // 5. 核心逻辑：根据最新的 courseware 更新案台和活跃组状态
    if (courseware && courseware.groups) {
        // 自动清理：如果某个组在 courseware 中已经不存在，则从活跃组中移除
        // 注意：即使组内没有点，也应该保留在 existingGroupNames 中，否则空组无法在 UI 列表中刷新出来
        const existingGroupNames = new Set(courseware.groups.map(g => g.name));
        activeSet.forEach(activeGroup => {
            if (!existingGroupNames.has(activeGroup)) {
                activeSet.delete(activeGroup);
            }
        });

        state["已加载组"] = Array.from(activeSet);

        state["案台"] = courseware.groups.map(group => {
            const adj = {};
            group.drawings.forEach(d => {
                if (d.associations && Array.isArray(d.associations)) {
                    d.associations.forEach(target => {
                        const [a, b] = [d.name, target].sort();
                        if (!adj[a]) adj[a] = new Set();
                        adj[a].add(b);
                    });
                }
            });
            const connections = Object.keys(adj).map(source => `${source} <-> ${Array.from(adj[source]).join(', ')}`);

            return {
                "组名": group.name,
                "状态": activeSet.has(group.name) ? "已加载到场上" : "在案未加载",
                "点之间的关系": connections.length > 0 ? connections : "无连线",
                "点位详情": group.drawings.map(d => ({ "名称": d.name, "内容": d.label || "无" }))
            };
        });
    }

    // 6. 强制写入磁盘
    const newStateRaw = JSON.stringify(state, null, 2);
    
    // 优化：仅当状态真正发生变化时才写入磁盘并触发刷新
    if (newStateRaw !== oldStateRaw) {
        fs.writeFileSync(statePath, newStateRaw, 'utf8');

    }
}

// 获取标准输入
async function getStdin() {
    let result = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
        result += chunk;
    }
    return result;
}

// 读取教案文件
function readCourseware(filePath) {
    if (!fs.existsSync(filePath)) {
        return { version: "1.0", coursewareName: "千里目默认教案", groups: [] };
    }
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // 兼容旧格式
        if (data.drawings && !data.groups) {
            return {
                version: data.version || "1.0",
                coursewareName: data.coursewareName || "千里目默认教案",
                groups: [{ name: "默认分组", drawings: data.drawings }]
            };
        }
        return data;
    } catch (e) {
        return { version: "1.0", coursewareName: "千里目默认教案", groups: [] };
    }
}

// 保存教案文件
function saveCourseware(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    // 同步更新语义摘要
    updateUIState(null, data);
}

// 处理参数鲁棒性 (同义词、大小写)
function getArg(args, keys) {
    for (const key of keys) {
        if (args[key] !== undefined) return args[key];
        // 尝试小写匹配
        const lowerKey = key.toLowerCase();
        for (const k in args) {
            if (k.toLowerCase() === lowerKey) return args[k];
        }
    }
    return undefined;
}


// 待执行指令队列 (用于下发给 UI)
let pendingCommands = [];
// 截图结果存储 (用于 AI 获取)
let screenshotResults = new Map();

// 处理 FlyTo 指令
function handleFlyTo(args) {
    let lon = getArg(args, ['longitude', 'lon', 'lng']);
    let lat = getArg(args, ['latitude', 'lat']);
    let height = getArg(args, ['height', 'alt', 'altitude']);
    const locationName = getArg(args, ['locationName', 'name', 'location']);
    const pointName = getArg(args, ['pointName', 'point']);
    const screenshot = getArg(args, ['screenshot', 'capture']);

    // 确保经纬度是有效的数字，如果不是则置为 null
    lon = (lon !== undefined && lon !== null && !isNaN(parseFloat(lon))) ? parseFloat(lon) : null;
    lat = (lat !== undefined && lat !== null && !isNaN(parseFloat(lat))) ? parseFloat(lat) : null;

    let finalLocationName = locationName || pointName;

    // 1. 优先处理 pointName：在已加载组中搜索点位
    if (pointName) {
        const statePath = path.join(__dirname, 'ui-state.json');
        const coursewarePath = process.env.COURSEWARE_PATH || path.join(__dirname, 'courseware.json');
        if (fs.existsSync(statePath)) {
            try {
                const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                const courseware = readCourseware(coursewarePath);
                
                let foundPoint = null;
                // 优先在所有组中搜索点位，确保即使未加载也能获取精确坐标
                for (const group of courseware.groups) {
                    if (group.drawings) {
                        const drawing = group.drawings.find(d => d.name === pointName);
                        if (drawing && drawing.position) {
                            foundPoint = drawing;
                            break;
                        }
                    }
                }

                if (foundPoint) {
                    lon = foundPoint.position.longitude;
                    lat = foundPoint.position.latitude;
                    // 优先使用传入的高度，如果没有传入则使用点位保存的高度
                    height = height || foundPoint.position.height;
                    finalLocationName = `${pointName} (来自教案库)`;
                } else if (!locationName) {
                    // 如果提供了 pointName 但没找到，且没有提供 locationName，则尝试将 pointName 作为地名搜索
                    finalLocationName = pointName;
                }
            } catch (e) {
                console.error("搜索已加载点位失败:", e);
            }
        }
    }

    const commandId = `cmd_${Date.now()}`;
    const command = {
        id: commandId,
        type: 'camera.flyTo',
        locationName: finalLocationName, // 传递地名或点名，让 UI 负责解析
        destination: (lon !== null && lat !== null) ? {
            longitude: lon,
            latitude: lat,
            height: parseFloat(height || 500)
        } : null,
        height: parseFloat(height || 500), // 显式传递高度，供 UI 解析地名时使用
        duration: parseFloat(getArg(args, ['duration', 'speed'])) || 0.8, // 允许自定义时长，默认 0.8s
        screenshot: !!screenshot
    };
    
    // 将指令推入队列，等待 UI 轮询
    pendingCommands.push(command);

    const locDesc = finalLocationName ? `地标：${finalLocationName}` : `${lat}, ${lon}`;
    
    // 如果需要截图，我们需要一种机制让 AI 等待或在后续轮询中获取
    // 这里先返回指令已下发的响应
    return {
        message: `已向地图发送飞行指令，目标：${locDesc}${screenshot ? ' (正在生成截图...)' : ''}`,
        commandId: commandId,
        frontendCommand: command
    };
}

// 处理 AddDrawing 指令
function handleAddDrawing(args, filePath) {
    const courseware = readCourseware(filePath);
    const groupName = getArg(args, ['groupName', 'group']) || "默认分组";
    
    let group = courseware.groups.find(g => g.name === groupName);
    if (!group) {
        group = { name: groupName, drawings: [] };
        courseware.groups.push(group);
    }

    const name = getArg(args, ['name', 'id']);
    const lon = getArg(args, ['longitude', 'lon', 'lng']);
    const lat = getArg(args, ['latitude', 'lat']);
    const height = getArg(args, ['height', 'alt', 'altitude']) || 500;

    let associations = getArg(args, ['associations', 'links']);
    if (associations === undefined || associations === null) {
        associations = [];
    } else if (typeof associations === 'string') {
        const trimmed = associations.trim();
        // 尝试解析 JSON 数组格式，例如 '["诸暨"]'
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                associations = JSON.parse(trimmed);
            } catch (e) {
                // 如果解析失败，回退到逗号分割逻辑
                associations = trimmed.split(',').map(s => s.trim()).filter(s => s);
            }
        } else if (trimmed) {
            // 如果是普通字符串且非空，作为单元素数组处理
            associations = [trimmed];
        } else {
            associations = [];
        }
    }
    // 强制转换为数组，防止意外
    if (!Array.isArray(associations)) {
        associations = associations ? [associations] : [];
    }

    const newDrawing = {
        name: name,
        region: {
            large: getArg(args, ['largeRegion', 'large']) || "未知大区",
            small: getArg(args, ['smallRegion', 'small']) || "未知地区"
        },
        position: {
            longitude: parseFloat(lon),
            latitude: parseFloat(lat),
            height: parseFloat(height)
        },
        label: getArg(args, ['label', 'desc', 'description']),
        associations: associations,
        style: {
            color: getArg(args, ['color', 'style']) || "red",
            pointSize: parseInt(getArg(args, ['size', 'pointSize']) || 10)
        }
    };

    const index = group.drawings.findIndex(d => d.name === newDrawing.name);
    if (index > -1) {
        group.drawings[index] = newDrawing;
    } else {
        group.drawings.push(newDrawing);
    }

    // 实现双向关联：确保被关联的点也关联回当前点
    if (associations.length > 0) {
        associations.forEach(targetName => {
            const targetDrawing = group.drawings.find(d => d.name === targetName);
            if (targetDrawing) {
                // 防御性处理：如果旧数据中 associations 是字符串，强制转为数组
                if (typeof targetDrawing.associations === 'string') {
                    targetDrawing.associations = [targetDrawing.associations];
                }
                if (!targetDrawing.associations || !Array.isArray(targetDrawing.associations)) {
                    targetDrawing.associations = [];
                }
                if (!targetDrawing.associations.includes(newDrawing.name)) {
                    targetDrawing.associations.push(newDrawing.name);
                }
            }
        });
    }

    saveCourseware(filePath, courseware);
    // 只要添加了点，该组就视为活跃
    updateUIState(null, courseware, groupName);

    // 自动触发 UI 加载：下发 LoadCourseware 指令给 UI，实现“即加即显”
    // 注意：如果指令是由 UI 触发的（uiTriggered），则不需要再次下发加载指令，
    // 因为 UI 已经在本地处理了刷新逻辑，再次下发会导致死循环。
    if (!args.uiTriggered) {
        handleLoadCourseware({ groupName: groupName }, filePath);
    }

    return {
        message: `成功添加教案标绘：${newDrawing.name} 到组 [${groupName}]。该点已持久化保存。`,
        data: newDrawing,
        groups: courseware.groups // 返回更新后的全量分组数据
    };
}

// 处理 LoadCourseware 指令 (生成 CZML)
function handleLoadCourseware(args, filePath) {
    const courseware = readCourseware(filePath);
    const groupNameInput = getArg(args, ['groupName', 'group']);
    // 加载教案时也同步更新案台状态，并记录当前加载的分组
    updateUIState(null, courseware, groupNameInput || "全量教案");
    
    // 构造下发给 UI 的指令
    const loadCommand = {
        id: `cmd_load_${Date.now()}`,
        type: 'data.loadCZML',
        groupName: groupNameInput || "全量教案"
    };

    const packets = [{ id: 'document', name: courseware.coursewareName || "千里目默认教案", version: '1.0' }];
    let totalDrawings = 0;

    if (courseware.groups && Array.isArray(courseware.groups)) {
        // 支持逗号分隔的多个组名
        const targetGroups = groupNameInput ? groupNameInput.split(',').map(g => g.trim()) : null;

        // 如果指定了组名，则只加载匹配的组；否则加载全部
        const groupsToLoad = targetGroups
            ? courseware.groups.filter(g => targetGroups.includes(g.name))
            : courseware.groups;

        groupsToLoad.forEach(group => {
            const drawingMap = new Map();
            const adj = new Map();
            group.drawings.forEach(d => {
                drawingMap.set(d.name, d);
                adj.set(d.name, []);
            });

            // 1. 建立邻接表
            group.drawings.forEach(d => {
                if (d.associations) {
                    d.associations.forEach(targetName => {
                        if (drawingMap.has(targetName)) {
                            adj.get(d.name).push(targetName);
                            adj.get(targetName).push(d.name);
                        }
                    });
                }
            });

            // 2. 棋子着色逻辑 (BFS)
            const colors = new Map();
            const visited = new Set();
            group.drawings.forEach(d => {
                if (visited.has(d.name)) return;
                const neighbors = adj.get(d.name);
                if (!neighbors || neighbors.length === 0) {
                    colors.set(d.name, 'yinyang');
                    visited.add(d.name);
                    return;
                }
                const queue = [[d.name, 'black']];
                visited.add(d.name);
                while (queue.length > 0) {
                    const [curr, color] = queue.shift();
                    colors.set(curr, color);
                    const nextColor = color === 'black' ? 'white' : 'black';
                    adj.get(curr).forEach(neighbor => {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push([neighbor, nextColor]);
                        }
                    });
                }
            });

            const qiziMap = {
                'yinyang': '/assets/qizi/阴阳.png',
                'black': '/assets/qizi/黑.png',
                'white': '/assets/qizi/白.png'
            };

            totalDrawings += group.drawings.length;

            group.drawings.forEach(d => {
                if (!d.position) return;
                const lon = parseFloat(d.position.longitude);
                const lat = parseFloat(d.position.latitude);
                if (isNaN(lon) || isNaN(lat)) return;

                const entityId = `${group.name}_${d.name}`;
                const qiziType = colors.get(d.name) || 'yinyang';

                // 灵气/雾气特效：使用第二个 Billboard 实现渐变仙气感
                // 这种方式可以像标绘点一样在任何高度可见，并支持 disableDepthTestDistance
                const mistImage = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cmFkaWFsR3JhZGllbnQgaWQ9ImdyYWQiIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjUwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6d2hpdGU7c3RvcC1vcGFjaXR5OjEiIC8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjp3aGl0ZTtzdG9wLW9wYWNpdHk6MCIgLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI2NCIgZmlsbD0idXJsKCNncmFkKSIgLz48L3N2Zz4=";
                
                packets.push({
                    id: `${entityId}_mist`,
                    name: `${d.name}_雾气`,
                    position: { cartographicDegrees: [lon, lat, 500] },
                    billboard: {
                        image: mistImage,
                        width: 32, // 缩小范围，比棋子(24)大一点
                        height: 32,
                        color: { rgba: [255, 223, 0, 120] }, // 金色渐变雾气
                        heightReference: 'RELATIVE_TO_GROUND',
                        verticalOrigin: 'CENTER',
                        disableDepthTestDistance: 10000, // 缩小深度测试禁用距离，恢复正常的遮挡关系
                        eyeOffset: { cartesian: [0, 0, 10] } // 稍微推后，确保在棋子下方
                    }
                });
                
                const packet = {
                    id: entityId,
                    name: d.name,
                    position: { cartographicDegrees: [lon, lat, 500] },
                    billboard: {
                        image: qiziMap[qiziType],
                        width: 24,
                        height: 24,
                        heightReference: 'RELATIVE_TO_GROUND',
                        verticalOrigin: 'CENTER',
                        disableDepthTestDistance: 10000, // 缩小深度测试禁用距离，恢复正常的遮挡关系
                        eyeOffset: { cartesian: [0, 0, 0] } // 棋子在中间
                    },
                    label: {
                        text: d.name,
                        font: 'bold 64px "Segoe UI", "MicroSoft YaHei", sans-serif',
                        fillColor: { rgba: [255, 255, 255, 255] },
                        outlineColor: { rgba: [0, 0, 0, 255] },
                        outlineWidth: 4,
                        style: 'FILL_AND_OUTLINE',
                        scale: 0.25,
                        pixelOffset: { cartesian2: [0, -40] },
                        horizontalOrigin: 'CENTER',
                        verticalOrigin: 'BOTTOM',
                        heightReference: 'RELATIVE_TO_GROUND',
                        show: true,
                        disableDepthTestDistance: 10000 // 缩小深度测试禁用距离，防止在地球背面可见
                    },
                    description: `组: ${group.name}\n${d.label || ""}`
                };
                packets.push(packet);

                // 连线处理
                if (d.associations && Array.isArray(d.associations)) {
                    d.associations.forEach(targetName => {
                        const target = drawingMap.get(targetName);
                        if (target && target.position) {
                            const tLon = parseFloat(target.position.longitude);
                            const tLat = parseFloat(target.position.latitude);
                            if (!isNaN(tLon) && !isNaN(tLat)) {
                                packets.push({
                                    id: `link_${entityId}_${targetName}`,
                                    polyline: {
                                        positions: { cartographicDegrees: [lon, lat, 0, tLon, tLat, 0] },
                                        width: 3,
                                        material: {
                                            polylineGlow: {
                                                color: { rgba: [255, 223, 0, 255] }, // 亮金色
                                                glowPower: 0.3
                                            }
                                        },
                                        clampToGround: true,
                                        arcType: 'GEODESIC'
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });
    }

    const loadMsg = groupNameInput
        ? `已加载教案组 [${groupNameInput}]，共 ${totalDrawings} 个标绘点。`
        : `已加载全量教案，共 ${courseware.groups.length} 个分组，${totalDrawings} 个标绘点。`;

    const result = {
        message: loadMsg,
        czml: packets,
        groups: courseware.groups // 返回分组数据
    };

    // 将指令推入队列，等待 UI 轮询
    // 如果是 UI 触发的，则不需要再次下发指令，否则会形成死循环
    if (!args.uiTriggered) {
        loadCommand.czml = packets;
        pendingCommands.push(loadCommand);
    }

    return result;
}

// 处理 RemoveDrawings 指令
function handleRemoveDrawings(args, filePath) {
    const courseware = readCourseware(filePath);
    const groupName = getArg(args, ['groupName', 'group']) || "默认分组";
    const group = courseware.groups.find(g => g.name === groupName);
    
    if (!group) {
        return { message: `未找到组: ${groupName}`, removedCount: 0 };
    }

    const level = getArg(args, ['level', 'type']) || 'point';
    const namesInput = getArg(args, ['names', 'name']);

    // 1. 删除整个组
    if (level === 'group') {
        courseware.groups = courseware.groups.filter(g => g.name !== groupName);
        saveCourseware(filePath, courseware);
        // 强制从 ui-state 中移除该组
        const statePath = path.join(__dirname, 'ui-state.json');
        if (fs.existsSync(statePath)) {
            try {
                const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                state["场上活跃组"] = (state["场上活跃组"] || []).filter(g => g !== groupName);
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
            } catch (e) {}
        }
        updateUIState(null, courseware);

        // 下发指令给 UI 刷新地图
        if (!args.uiTriggered) {
            pendingCommands.push({
                id: `cmd_remove_group_${Date.now()}`,
                type: 'data.loadCZML',
                groupName: groupName
            });
        }

        return {
            message: `成功删除组：${groupName}`,
            groups: courseware.groups
        };
    }

    if (!namesInput) throw new Error("必须提供要删除的名称（names）。");
    const itemsToRemove = namesInput.split(',').map(n => n.trim());

    // 2. 删除连线
    if (level === 'line') {
        let removedLines = [];
        itemsToRemove.forEach(lineName => {
            if (lineName.includes('-')) {
                const [nameA, nameB] = lineName.split('-');
                let changed = false;
                
                const drawingA = group.drawings.find(d => d.name === nameA);
                if (drawingA && drawingA.associations) {
                    const initialLen = drawingA.associations.length;
                    drawingA.associations = drawingA.associations.filter(n => n !== nameB);
                    if (drawingA.associations.length !== initialLen) changed = true;
                }

                const drawingB = group.drawings.find(d => d.name === nameB);
                if (drawingB && drawingB.associations) {
                    const initialLen = drawingB.associations.length;
                    drawingB.associations = drawingB.associations.filter(n => n !== nameA);
                    if (drawingB.associations.length !== initialLen) changed = true;
                }
                if (changed) removedLines.push(lineName);
            }
        });

        if (removedLines.length > 0) {
            saveCourseware(filePath, courseware);

            // 下发指令给 UI 刷新地图
            if (!args.uiTriggered) {
                pendingCommands.push({
                    id: `cmd_remove_lines_${Date.now()}`,
                    type: 'data.loadCZML',
                    groupName: groupName
                });
            }

            return {
                message: `成功从组 [${groupName}] 中删除连线：${removedLines.join(', ')}`,
                groups: courseware.groups
            };
        }
        return { message: `未找到指定的连线。`, groups: courseware.groups };
    }

    // 3. 批量删除点
    const initialCount = group.drawings.length;
    
    // 过滤掉目标点
    group.drawings = group.drawings.filter(d => !itemsToRemove.includes(d.name));
    
    // 自动清理其他点对这些被删除点的关联引用
    group.drawings.forEach(d => {
        if (d.associations) {
            d.associations = d.associations.filter(assoc => !itemsToRemove.includes(assoc));
        }
    });

    const removedCount = initialCount - group.drawings.length;
    saveCourseware(filePath, courseware);

    const result = {
        message: `从组 [${groupName}] 中成功删除 ${removedCount} 个标绘点，并清理了相关连线。`,
        removedNames: itemsToRemove,
        groups: courseware.groups
    };

    // 下发指令给 UI 刷新地图
    if (!args.uiTriggered) {
        pendingCommands.push({
            id: `cmd_remove_points_${Date.now()}`,
            type: 'data.loadCZML',
            groupName: groupName
        });
    }

    return result;
}

// 导出给 VCP Distributed Server 的集成接口
async function processToolCall(args) {
    const command = args.command;
    const coursewarePath = process.env.COURSEWARE_PATH || path.join(__dirname, 'courseware.json');

    // 启动文件监听，确保手动修改 courseware.json 时自动更新 UI 状态
    if (!global.coursewareWatcher) {
        let watchTimer = null;
        global.coursewareWatcher = fs.watch(coursewarePath, (eventType) => {
            if (eventType === 'change') {
                // 防抖处理：避免某些编辑器保存时多次触发，或与 updateUIState 的写操作形成竞争
                if (watchTimer) clearTimeout(watchTimer);
                watchTimer = setTimeout(() => {
                    console.log(`[Qianlimu] Courseware file changed, updating UI state...`);
                    const updatedCourseware = readCourseware(coursewarePath);
                    updateUIState(null, updatedCourseware);
                }, 500);
            }
        });
    }

    let resultData;
    switch (command) {
        case 'FlyTo':
            resultData = handleFlyTo(args);
            // 如果需要截图，循环等待结果 (最多等待 10 秒)
            if (args.screenshot) {
                const cmdId = resultData.commandId;
                // VCP 分布式服务器超时限制已放宽到 10s，我们等待约 9s
                for (let i = 0; i < 30; i++) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    if (screenshotResults.has(cmdId)) {
                        const result = screenshotResults.get(cmdId);
                        
                        if (result.path) {
                            // UI 已经通过 IPC 保存了文件并返回了路径
                            resultData.screenshot = result.path;
                            resultData.message += " 截图已就绪。";
                        }
                        
                        screenshotResults.delete(cmdId);
                        break;
                    }
                }
            }
            // 清洗 FlyTo 数据：删除冗余的指令对象
            delete resultData.commandId;
            delete resultData.frontendCommand;
            break;
        case 'AddDrawing':
            resultData = handleAddDrawing(args, coursewarePath);
            // 数据清洗：如果是 AI 调用（非 UI 触发），移除冗余数据
            if (!args.uiTriggered) {
                cleanAIPayload(resultData);
            }
            break;
        case 'LoadCourseware':
            resultData = handleLoadCourseware(args, coursewarePath);
            // 数据清洗：如果是 AI 调用（非 UI 触发），移除冗余数据
            if (!args.uiTriggered) {
                cleanAIPayload(resultData);
            }
            break;
        case 'RemoveDrawings':
            resultData = handleRemoveDrawings(args, coursewarePath);
            // 数据清洗：如果是 AI 调用（非 UI 触发），移除冗余数据
            if (!args.uiTriggered) {
                cleanAIPayload(resultData);
            }
            break;
        case 'OpenUI':
            updateUIState("已启动", readCourseware(coursewarePath));
            return {
                status: "success",
                result: { message: "正在为您打开千里目智能地理教学界面..." },
                _specialAction: "open_qianlimu"
            };
        default: throw new Error(`未知指令: ${command}`);
    }
    return { status: "success", result: resultData };
}

/**
 * 数据清洗：为 AI 移除冗余的渲染和全量数据
 */
function cleanAIPayload(data) {
    if (!data) return;

    // 1. 移除极其庞大的 CZML 数据（AI 不需要原始渲染指令）
    if (data.czml) {
        delete data.czml;
    }

    // 2. 极致精简 data 对象（仅保留名称和标签文字，移除坐标、样式等）
    if (data.data && typeof data.data === 'object') {
        const essentialData = {
            name: data.data.name,
            label: data.data.label
        };
        // 如果有关联关系，保留名称即可
        if (data.data.associations) {
            essentialData.associations = data.data.associations;
        }
        data.data = essentialData;
    }

    // 3. 极致精简 groups 列表
    if (data.groups && Array.isArray(data.groups)) {
        // 仅保留组名，移除点位数量和所有详情
        data.availableGroups = data.groups.map(g => g.name);
        delete data.groups;
    }

    // 4. 移除其他可能存在的非文字字段
    if (data.removedNames) {
        // 保留被删除的名称列表，这对 AI 确认结果有用
    }
}

// 注册路由接口，将插件 UI 和 API 集成到 Vchat 后端
function registerRoutes(app, config, projectBasePath) {
    const express = require('express');
    
    const uiPath = path.join(__dirname, 'ui');
    
    // 1. 挂载静态 UI 页面
    app.use('/qianlimu', express.static(uiPath));

    // 1.1 挂载主项目 assets 目录，以便 UI 访问壁纸
    // 注意：projectBasePath 是 VCPDistributedServer 目录，assets 在其上一级
    const assetsPath = path.join(projectBasePath, '..', 'assets');
    app.use('/assets', express.static(assetsPath));

    // 1.2 挂载主项目 styles 目录，以便 UI 访问主题变量
    const stylesPath = path.join(projectBasePath, '..', 'styles');
    app.use('/styles', express.static(stylesPath));

    // 2. 获取配置接口
    app.get('/qianlimu/api/config', (req, res) => {
        const envPath = path.join(__dirname, 'config.env');
        const configData = { ION_TOKEN: '', DEFAULT_MAP_ID: '' };
        
        const fsSync = require('fs');
        if (fsSync.existsSync(envPath)) {
            const content = fsSync.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach(line => {
                if (line.startsWith('ION_TOKEN=')) {
                    configData.ION_TOKEN = line.split('=')[1].trim();
                } else if (line.startsWith('DEFAULT_MAP_ID=')) {
                    configData.DEFAULT_MAP_ID = line.split('=')[1].trim();
                }
            });
        }
        res.json(configData);
    });

    // 增加 Body 解析限制，防止截图 Base64 导致 PayloadTooLargeError
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // 3. 插件调用接口 (转发给 processToolCall)
    app.post('/qianlimu/api/plugin', async (req, res) => {
        try {
            const result = await processToolCall(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    });

    // 4. 状态同步接口：由 UI 实时汇报“场上”活跃组
    app.post('/qianlimu/api/state/sync', async (req, res) => {
        try {
            const { activeGroups } = req.body;
            const coursewarePath = process.env.COURSEWARE_PATH || path.join(__dirname, 'courseware.json');
            const courseware = readCourseware(coursewarePath);
            
            // 强制更新 ui-state.json，以 UI 汇报的活跃组为准
            const statePath = path.join(__dirname, 'ui-state.json');
            let state = { "千里目状态": "已启动", "已加载组": activeGroups || [], "案台": [] };
            
            if (fs.existsSync(statePath)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                    state["千里目状态"] = existing["千里目状态"];
                } catch(e) {}
            }

            // 重新生成案台摘要，并标记状态
            const activeSet = new Set(state["已加载组"]);
            state["案台"] = courseware.groups.map(group => {
                const adj = {};
                group.drawings.forEach(d => {
                    if (d.associations && Array.isArray(d.associations)) {
                        d.associations.forEach(target => {
                            const [a, b] = [d.name, target].sort();
                            if (!adj[a]) adj[a] = new Set();
                            adj[a].add(b);
                        });
                    }
                });
                const connections = Object.keys(adj).map(source => `${source} <-> ${Array.from(adj[source]).join(', ')}`);
                return {
                    "组名": group.name,
                    "状态": activeSet.has(group.name) ? "已加载到场上" : "在案未加载",
                    "点之间的关系": connections.length > 0 ? connections : "无连线",
                    "点位详情": group.drawings.map(d => ({ "名称": d.name, "内容": d.label || "无" }))
                };
            });

            fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
            res.json({ status: 'success' });
        } catch (error) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    });

    // 5. 指令轮询接口：UI 获取待执行指令
    app.get('/qianlimu/api/commands', (req, res) => {
        res.json(pendingCommands);
        pendingCommands = []; // 获取后清空
    });

    // 6. 截图回传接口：UI 完成指令后回传结果
    app.post('/qianlimu/api/commands/result', (req, res) => {
        const { commandId, screenshotPath } = req.body;
        if (commandId && screenshotPath) {
            screenshotResults.set(commandId, { path: screenshotPath });
        }
        res.json({ status: 'success' });
    });

    console.log(`[Qianlimu] Plugin integrated into Vchat server at /qianlimu`);
}

module.exports = {
    processToolCall,
    registerRoutes
};

// 兼容命令行直接运行模式
if (require.main === module) {
    (async () => {
        try {
            const input = await getStdin();
            if (!input) return;
            const result = await processToolCall(JSON.parse(input));
            console.log(JSON.stringify(result));
        } catch (error) {
            console.log(JSON.stringify({ status: "error", error: error.message }));
        }
    })();
}