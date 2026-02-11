const fs = require('fs');
const path = require('path');

function getQianlimuState() {
    try {
        // 指向 qianlimu 插件的数据目录
        const uiStatePath = path.join(__dirname, '..', 'qianlimu', 'ui-state.json');
        const coursewarePath = path.join(__dirname, '..', 'qianlimu', 'courseware.json');

        if (!fs.existsSync(uiStatePath) || !fs.existsSync(coursewarePath)) {
            return "数据文件缺失 (等待 qianlimu 初始化)";
        }

        const uiStateRaw = fs.readFileSync(uiStatePath, 'utf8').trim();
        let coursewareRaw = fs.readFileSync(coursewarePath, 'utf8').trim();

        if (!uiStateRaw) return "UI状态文件内容为空";
        if (!coursewareRaw) coursewareRaw = '{"groups": []}';

        const uiState = JSON.parse(uiStateRaw);
        const courseware = JSON.parse(coursewareRaw);

        const status = uiState["千里目状态"] || "未启动";
        const loadedGroups = uiState["已加载组"] || [];
        const allGroups = (courseware.groups || []).map(g => g.name);

        let report = `千里目状态: ${status}\n`;
        report += `所有分组: ${allGroups.join('、')}\n`;
        
        if (loadedGroups.length > 0) {
            report += `已加载: ${loadedGroups.join('、')}\n`;
            loadedGroups.forEach(groupName => {
                const groupDetail = (uiState["案台"] || []).find(g => g["组名"] === groupName);
                if (groupDetail) {
                    report += `${groupName}:\n`;
                    let rawRelations = groupDetail["点之间的关系"];
                    if (Array.isArray(rawRelations)) rawRelations = rawRelations.join(',');
                    const relations = (rawRelations === "无连线" || !rawRelations) ? "无连线" : rawRelations.split(',').map(r => `"${r.trim()}"`).join(',');
                    report += `点之间的关系: ${relations}\n`;
                    if (groupDetail["点位详情"] && groupDetail["点位详情"].length > 0) {
                        const points = groupDetail["点位详情"].map(p => `"${p["名称"]}": "${p["内容"]}"`).join(', ');
                        report += `点位: ${points}\n`;
                    }
                }
            });
        } else {
            report += `已加载: 无`;
        }
        return report.trim();
    } catch (e) {
        return `错误: ${e.message}`;
    }
}

const currentState = getQianlimuState();
const lastStatePath = path.join(__dirname, 'last-reported-state.txt');

let shouldReport = true;
if (fs.existsSync(lastStatePath)) {
    const lastState = fs.readFileSync(lastStatePath, 'utf8');
    if (lastState === currentState) {
        shouldReport = false;
    }
}

if (shouldReport) {
    fs.writeFileSync(lastStatePath, currentState, 'utf8');
    const result = {
        "{{VCPQianlimuState}}": currentState
    };
    console.log(JSON.stringify(result));
}