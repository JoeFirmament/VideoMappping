# 相机校正启动问题修复日志

## 问题描述
**时间**: 2024年12月19日  
**问题**: 前端加载内参标定之后，启动相机校正马上变绿，但是画面没有校正。需要再点击一次启动校正，才会生效。

## 问题分析

### 根本原因
前端和后端的相机校正状态不同步：

1. **前端问题** (`static/script.js:2288-2289`):
   - 加载标定后，前端直接设置UI状态为启用：`this.enableCameraCorrectionToggle.checked = true`
   - 调用`this.updateCorrectionStatus('active')`更新显示
   - **但没有向后端发送实际的启用命令**

2. **后端问题** (`src/main.cpp:397`):
   - `loadCameraCalibrationData()`方法只加载数据
   - **没有自动启用相机校正功能**
   - 后端的`cameraCorrectionEnabled_`标志仍然是false

### 问题流程
```
1. 用户加载内参标定
   ↓
2. 后端：加载数据成功，但cameraCorrectionEnabled_ = false
   ↓
3. 前端：收到成功响应，设置UI为启用状态（绿色）
   ↓
4. 用户看到绿色，以为校正已启用，但实际后端未启用
   ↓
5. 用户第一次点击：前端发现开关是checked，发送disable命令
   ↓
6. 用户第二次点击：前端发送enable命令，这时才真正启用
```

## 解决方案

### 1. 后端修复 ✅
**文件**: `src/main.cpp:399-401`
```cpp
// 🔧 修复：加载标定数据后自动启用相机校正
streamer.setCameraCorrectionEnabled(true);
std::cout << "📸 [CAMERA CORRECTION] Auto-enabled after calibration load" << std::endl;
```

**文件**: `src/main.cpp:447-448`
```cpp
response << "\"correction_enabled\":true";  // 告知前端校正已自动启用
```

### 2. 前端修复 ✅
**文件**: `static/script.js:2287-2298`
```javascript
// 🔧 修复：根据后端响应同步校正状态
const correctionEnabled = data.correction_enabled || false;
this.enableCameraCorrectionToggle.checked = correctionEnabled;
this.updateCorrectionStatus(correctionEnabled ? 'active' : 'inactive');

// 同步浮动面板状态
if (this.floatingEnableCameraCorrectionToggle) {
    this.floatingEnableCameraCorrectionToggle.checked = correctionEnabled;
    this.floatingEnableCameraCorrectionToggle.disabled = false;
}
this.updateFloatingCorrectionStatus(correctionEnabled ? 'active' : 'inactive');
```

## 修复效果

### 修复前
1. 加载标定 → 前端显示绿色但后端未启用
2. 第一次点击 → 发送disable命令
3. 第二次点击 → 发送enable命令，真正启用

### 修复后
1. 加载标定 → 后端自动启用校正，前端同步状态显示绿色
2. 第一次点击 → 直接生效，无需二次点击

## 调试验证

### 后端日志验证
```bash
# 查看后端是否输出自动启用日志
📸 [CAMERA CORRECTION] Auto-enabled after calibration load
```

### 前端日志验证
```javascript
// 查看浏览器控制台是否输出同步日志
📸 [CAMERA CORRECTION] Synced with backend state: enabled
```

### 功能验证
1. 加载内参标定文件
2. 观察校正开关是否立即变绿
3. 观察视频流是否立即应用校正效果
4. 点击一次校正开关，验证是否直接生效

## 相关文件
- `src/main.cpp` - 后端WebSocket消息处理
- `src/VideoStreamer.cpp` - 相机校正控制
- `static/script.js` - 前端校正状态管理

## 版本标记
- **修复版本**: v2.2-camera-correction-fix
- **Git提交**: "fix: sync camera correction state between frontend and backend after calibration load" 