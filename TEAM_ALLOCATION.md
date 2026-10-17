# 五人代码分工 — Cyclist Go BCC 版

这是建议的后续维护分工，不代表任何组员已经完成了这些代码。人员编号沿用你提供的图2，提交时请替换成真实姓名并记录实际贡献。

| 人员 | 负责文件 | 工作范围 | 与其他人的接口 |
|---|---|---|---|
| **1** | `dist/core.js`、`dist/app.js`、`dist/base.css`、`dist/index.html` | 公共状态、浏览器存储入口、页面切换、应用初始化、整体页面与公共样式、弹窗和消息提示 | 维护 `state`、`showView()`、`save()`、`toast()`；统一 HTML 容器 ID 与脚本顺序 |
| **2** | `dist/planner.js`、`dist/planner.css`、`dist/routes.js` | 输入目的地、建议列表、预计算 OSM/BRouter 路线读取与排序、候选路线、三种路线偏好、距离/估算时长、路线卡片及详情 | `RideData.buildRoutes()` 输出路线；通过 `Preferences` 获取筛选结果；地图接收所选路线 |
| **3** | `dist/map.js`、`dist/map.css`、`scripts/fetch_data.py`、`scripts/fetch_routes.py`、`scripts/build_data.py`、`dist/data/` | Leaflet 地图、路线/风险标记、缩放和图层；下载 BCC 数据、匹配 OSM 路线与 BCC 属性、匹配信号流量与地形数据、维护来源 | 向第2/5人提供 `BCC_DATA`；不能自行填补缺失道路；变更数据结构前通知第2/5人 |
| **4** | `dist/hazards.js`、`dist/hazards.css` | 已上报/潜在风险、示例风险、筛选与详情、两步上报、可选备注与位置、反馈、删除与撤销 | 使用第1人的存储服务；位置沿第2人的路线；第3人负责地图上绘制标记 |
| **5** | `dist/ride.js`、`dist/ride.css`、**`dist/preferences.js`、`dist/preferences.css`** | 模拟骑行、位置移动、剩余距离/时长、暂停/继续、骑行总结；**新增四项 route preference 筛选、指标计算、缺失数据处理、清空筛选和匹配结果** | 用 `Preferences.evaluate()` 计算指标，`accepts()` 判断匹配，`applyPreferences()` 联动卡片与地图；不修改源数据 |

## 新增功能为什么分给第5人

按原有职责检查，模拟骑行逻辑比较独立，核心功能约 2,633 字符；目的地/比较约 3,211，地图约 4,389，hazard 约 4,729。第1人的公共 JS 虽较短，但还承担 `index.html`、整体样式和整合工作，不能只看 JS 长度判断其工作量。

因此将新增的 **preferences.js / preferences.css** 并入第5人的任务，而不是继续堆到已经负责寻路的第2人。代码量只是分工参考，最终还应结合组员熟悉程度和实际工时调整。

## 第5人的新增任务具体包括

1. 四个复选框：More bikeways、Less traffic、Fewer hills、Hill training（后两项互斥）。
2. 输入目的地页面与路线比较页面的复选框保持同步。
3. 多选条件按 AND 处理：必须同时符合所有选中条件。
4. More bikeways 比较 BCC 识别路段占比，off-road 占比单独显示；不表示已核验物理隔离。
5. 使用 BCC 信号实测流量/周期时间计算附近交通指标；使用 BCC 2002 等高线估算地面爬升、坡度和爬坡数量；所有指标显示覆盖率。
6. 缺失数据保持 Unknown，不能自动设置为 0、车少、安全或平坦。
7. 无匹配结果时清除选中路线、禁用开始骑行并显示 Clear filters。
8. 修改条件后同步刷新卡片、详情、地图和开始骑行按钮。

## 合作方式

- 每个人主要修改自己的 JS/CSS 文件，避免大家同时改一个巨大的 app.js。
- `index.html` 由第1人整合。其他人需要新容器或 ID 时，先交给第1人合并。
- 公共脚本没有打包构建：按 HTML 中的 defer 顺序加载，函数在初始化阶段之后调用。
- 测试文件 `tests.cjs` 由组员共同维护；当前测试不代表组员已完成审查。
- `dist/vendor/` 是第三方 Leaflet，保留授权，不作为原创贡献统计。
- `dist/data/` 是 OSM 路线、BCC 数据及其派生指标，不作为人工编写代码量统计。

## 数据与功能边界

- 起点为 Indooroopilly Shopping Centre 旁的真实地图路径；终点为 City Hall、UQ St Lucia 和 South Bank。页面披露与参考点的距离，不补画建筑物连接线。
- BCC bikeway 网络不连通，因此经确认使用 OSM/BRouter 预计算路线，并匹配 BCC bikeway、交通及历史地形指标。OSM 不再仅作底图。
- Less busy crossings 已移除。具体筛选、估算与覆盖规则见 DATA_SOURCES.md。
- hazard、反馈、草稿保存在本地浏览器；骑行是模拟，不是 GPS 导航。
