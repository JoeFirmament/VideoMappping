class VideoStream {
    constructor() {
        // 基本元素
        this.video = document.getElementById('video');
        this.statusElement = document.getElementById('status');
        this.fpsElement = document.getElementById('fps');
        this.resolutionElement = document.getElementById('resolution');
        this.latencyElement = document.getElementById('latency');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // 调试相关元素
        this.debugToggle = document.getElementById('debugToggle');
        this.debugInfo = document.getElementById('debugInfo');
        this.homographyMatrix = document.getElementById('homographyMatrix');
        this.lastOperation = document.getElementById('lastOperation');
        this.detectedMarkersCount = document.getElementById('detectedMarkersCount');
        this.exportMatrixBtn = document.getElementById('exportMatrixBtn');
        
        // 相机标定相关元素
        this.toggleCameraCalibrationBtn = document.getElementById('toggleCameraCalibrationBtn');
        this.addCalibrationImageBtn = document.getElementById('addCalibrationImageBtn');
        this.performCameraCalibrationBtn = document.getElementById('performCameraCalibrationBtn');
        this.saveCameraCalibrationBtn = document.getElementById('saveCameraCalibrationBtn');
        this.boardWidthInput = document.getElementById('boardWidthInput');
        this.boardHeightInput = document.getElementById('boardHeightInput');
        this.squareSizeInput = document.getElementById('squareSizeInput');
        this.setBoardSizeBtn = document.getElementById('setBoardSizeBtn');
        this.calibrationErrorDisplay = document.getElementById('calibrationErrorDisplay');
        
        // 初始化变量
        this.ws = null;
        this.connected = false;
        this.frameCount = 0;
        this.lastFrameCount = 0;
        this.lastFrameTime = 0;
        this.frameTimes = [];
        this.fps = 0;
        this.latency = 0;
        this.calibrationMode = false;
        this.calibrated = false;
        this.arucoMode = false;
        this.calibrationPoints = [];
        this.markerCoordinates = {};
        this.rawHomographyMatrix = null;
        
        // 相机标定相关状态
        this.cameraCalibrationMode = false;
        this.cameraCalibrated = false;
        this.calibrationImages = 0;
        
        // 媒体显示相关
        this.currentBlobUrl = null;
        
        // 初始化
        this.initialize();
    }
    
    initialize() {
        // 绑定方法到当前实例
        this.toggleCameraCalibrationMode = this.toggleCameraCalibrationMode.bind(this);
        
        this.setupEventListeners();
        this.connect();
        
        // 启动FPS计数器
        setInterval(() => this.updateFps(), 1000);
    }
    
    setupEventListeners() {
        // 开始按钮
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                this.start();
            });
        }
        
        // 停止按钮
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }
        
        // 全屏按钮
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 调试信息开关
        if (this.debugToggle) {
            this.debugToggle.addEventListener('change', () => {
                if (this.debugInfo) {
                    this.debugInfo.style.display = this.debugToggle.checked ? 'block' : 'none';
                }
            });
        }
        
        // 导出矩阵按钮
        if (this.exportMatrixBtn) {
            this.exportMatrixBtn.addEventListener('click', () => {
                this.exportHomographyMatrix();
            });
        }
        
        // 相机标定相关事件监听
        if (this.toggleCameraCalibrationBtn) {
            this.toggleCameraCalibrationBtn.addEventListener('click', () => {
                this.toggleCameraCalibrationMode();
            });
        }
        
        if (this.addCalibrationImageBtn) {
            this.addCalibrationImageBtn.addEventListener('click', () => {
                this.addCalibrationImage();
            });
        }
        
        if (this.performCameraCalibrationBtn) {
            this.performCameraCalibrationBtn.addEventListener('click', () => {
                this.performCameraCalibration();
            });
        }
        
        if (this.saveCameraCalibrationBtn) {
            this.saveCameraCalibrationBtn.addEventListener('click', () => {
                this.saveCameraCalibration();
            });
        }
        
        if (this.setBoardSizeBtn) {
            this.setBoardSizeBtn.addEventListener('click', () => {
                this.setBoardSize();
            });
        }
    }
    
    connect() {
        // 创建WebSocket连接
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket连接已建立');
            this.connected = true;
            this.updateStatus('connected', '已连接');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket连接已关闭:', event);
            this.connected = false;
            this.updateStatus('error', '连接已断开');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = true;
            
            // 5秒后尝试重新连接
            setTimeout(() => this.connect(), 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.updateStatus('error', 'WebSocket错误');
        };
        
        this.ws.onmessage = (event) => {
            try {
                // 如果消息是二进制数据（图像帧）
                if (event.data instanceof Blob) {
                    this.displayImageFrame(event.data);
                } else {
                    // 解析JSON消息
                    const message = JSON.parse(event.data);
                    console.log('Received message:', message);
                    
                    if (message.type === 'camera_calibration_status') {
                        this.handleCameraCalibrationStatus(message);
                    } else if (message.type === 'frame_info') {
                        this.handleFrameInfo(message);
                    }
                }
            } catch (e) {
                console.error('处理消息时出错:', e);
            }
        };
    }
    
    handleCameraCalibrationStatus(message) {
        console.log('Camera calibration status:', message);
        
        this.cameraCalibrationMode = message.calibration_mode;
        this.cameraCalibrated = message.calibrated;
        
        if (message.image_count !== undefined) {
            this.calibrationImages = message.image_count;
            if (this.lastOperation) {
                this.lastOperation.textContent = `当前已采集 ${this.calibrationImages} 幅标定图像`;
            }
        }
        
        if (message.error !== undefined) {
            this.calibrationErrorDisplay.textContent = message.error.toFixed(2) + ' 像素';
        }
        
        this.updateCameraCalibrationUI();
        
        // 显示相应的状态消息
        if (message.success !== undefined) {
            this.updateStatus(message.success ? 'success' : 'error', 
                            message.success ? '操作成功' : '操作失败');
        }
    }
    
    handleTextMessage(message) {
        try {
            const data = JSON.parse(message);
            console.log('收到消息:', data);
            
            if (data.type === 'status') {
                this.updateStatus(data.status, data.message);
            } else if (data.type === 'error') {
                console.error('服务器错误:', data.message);
                this.updateStatus('error', `错误: ${data.message}`);
                this.updateLastOperation(`错误: ${data.message}`);
            } else if (data.type === 'frame_info') {
                // 更新分辨率信息
                console.log(`收到帧信息: ${data.width}x${data.height}`);
                if (this.resolutionElement) {
                    this.resolutionElement.textContent = `${data.width}×${data.height}`;
                }
            } else if (data.type === 'calibration_result') {
                // 处理标定结果
                console.log('收到标定结果:', data);
                
                if (data.success) {
                    this.calibrated = true;
                    
                    // 更新单应性矩阵显示
                    if (data.homography_matrix) {
                        this.updateHomographyMatrix(data.homography_matrix);
                        this.updateLastOperation('标定成功，单应性矩阵已更新');
                    }
                }
            } else if (data.type === 'camera_calibration_status') {
                this.cameraCalibrationMode = data.calibration_mode;
                this.cameraCalibrated = data.calibrated;
                this.calibrationImages = data.image_count;
                this.updateCameraCalibrationUI();
                
                if (data.error !== undefined) {
                    this.calibrationErrorDisplay.textContent = data.error.toFixed(2) + ' 像素';
                }
            }
        } catch (error) {
            console.error('处理文本消息时出错:', error);
        }
    }
    
    handleBinaryMessage(data) {
        try {
            // 处理二进制消息（视频帧）
            const blob = new Blob([data], { type: 'image/jpeg' });
            this.displayImageFrame(blob);
        } catch (error) {
            console.error('处理二进制消息时出错:', error);
        }
    }
    
    updateStatus(status, message) {
        if (this.statusElement) {
            this.statusElement.textContent = message || status;
            this.statusElement.className = `status ${status}`;
        }
    }
    
    updateFps() {
        // 计算FPS
        const fps = this.frameCount - this.lastFrameCount;
        this.lastFrameCount = this.frameCount;
        this.fps = fps;
        
        // 更新FPS显示
        if (this.fpsElement) {
            this.fpsElement.textContent = `${this.fps} FPS`;
        }
    }
    
    start() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'start_stream'
            }));
        }
    }
    
    stop() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'stop_stream'
            }));
        }
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.video.requestFullscreen().catch(err => {
                console.error(`无法进入全屏模式: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    toggleCalibrationMode() {
        console.log('切换标定模式');
        
        // 切换标定模式状态
        this.calibrationMode = !this.calibrationMode;
        
        // 更新UI
        if (this.toggleCalibrationBtn) {
            this.toggleCalibrationBtn.textContent = this.calibrationMode ? '退出标定模式' : '进入标定模式';
        }
        
        // 显示/隐藏标定面板
        if (this.calibrationPanel) {
            this.calibrationPanel.style.display = this.calibrationMode ? 'block' : 'none';
        }
        
        // 显示/隐藏坐标测试面板
        if (this.coordinateTestPanel) {
            this.coordinateTestPanel.style.display = this.calibrated && !this.calibrationMode ? 'block' : 'none';
        }
        
        // 发送切换标定模式命令到服务器
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'toggle_calibration_mode'
            }));
        }
        
        // 更新状态
        this.updateStatus(this.calibrationMode ? 'info' : 'success', 
                         this.calibrationMode ? '已进入标定模式' : '已退出标定模式');
    }
    
    toggleCameraCalibrationMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket未连接');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }
        
        const message = {
            action: 'toggle_camera_calibration_mode'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        // 更新最后操作信息
        if (this.lastOperation) {
            this.lastOperation.textContent = '切换相机标定模式';
        }
    }
    
    addCalibrationImage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket未连接');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }
        
        const message = {
            action: 'add_calibration_image'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = '正在采集标定图像';
        }
    }
    
    performCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket未连接');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }
        
        const message = {
            action: 'perform_camera_calibration'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = '正在执行相机标定';
        }
    }
    
    saveCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket未连接');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }
        
        const message = {
            action: 'save_camera_calibration'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = '正在保存标定结果';
        }
    }
    
    setBoardSize() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket未连接');
            this.updateStatus('error', 'WebSocket未连接');
            return;
        }
        
        const width = parseInt(this.boardWidthInput.value);
        const height = parseInt(this.boardHeightInput.value);
        const squareSize = parseFloat(this.squareSizeInput.value) / 1000; // 转换为米
        
        if (isNaN(width) || isNaN(height) || isNaN(squareSize)) {
            alert('请输入有效的棋盘格参数！');
            return;
        }
        
        const message = {
            action: 'set_board_size',
            width: width,
            height: height,
            square_size: squareSize
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = '设置棋盘格参数';
        }
    }
    
    handleServerMessage(message) {
        // 处理相机标定相关消息
        if (message.type === 'camera_calibration_status') {
            this.cameraCalibrationMode = message.calibration_mode;
            this.cameraCalibrated = message.calibrated;
            this.calibrationImages = message.image_count;
            this.updateCameraCalibrationUI();
            
            if (message.error !== undefined) {
                this.calibrationErrorDisplay.textContent = message.error.toFixed(2) + ' 像素';
            }
        }
    }
    
    updateCameraCalibrationUI() {
        // 更新按钮状态
        this.toggleCameraCalibrationBtn.textContent = this.cameraCalibrationMode ? 
            '退出标定模式' : '相机标定模式';
        this.toggleCameraCalibrationBtn.classList.toggle('active', this.cameraCalibrationMode);
        
        this.addCalibrationImageBtn.disabled = !this.cameraCalibrationMode;
        this.performCameraCalibrationBtn.disabled = !this.cameraCalibrationMode || this.calibrationImages < 10;
        this.saveCameraCalibrationBtn.disabled = !this.cameraCalibrated;
        
        // 显示图像数量信息
        if (this.cameraCalibrationMode) {
            this.lastOperation.textContent = `已采集 ${this.calibrationImages} 幅标定图像`;
        }
    }
    
    updateHomographyMatrix(matrix) {
        if (this.homographyMatrix && matrix) {
            // 保存原始矩阵数据用于导出
            this.rawHomographyMatrix = matrix;
            
            // 格式化矩阵显示
            let formattedMatrix = '';
            
            // 检查矩阵格式（数组长度为9的一维数组）
            if (Array.isArray(matrix) && matrix.length === 9) {
                for (let i = 0; i < 3; i++) {
                    let row = [];
                    for (let j = 0; j < 3; j++) {
                        row.push(matrix[i*3 + j].toFixed(4));
                    }
                    formattedMatrix += row.join('  ') + '\n';
                }
            } 
            // 如果是3x3矩阵格式
            else if (Array.isArray(matrix) && matrix.length === 3 && Array.isArray(matrix[0])) {
                for (let i = 0; i < 3; i++) {
                    let row = [];
                    for (let j = 0; j < 3; j++) {
                        row.push(matrix[i][j].toFixed(4));
                    }
                    formattedMatrix += row.join('  ') + '\n';
                }
            }
            // 如果是字符串格式，直接显示
            else if (typeof matrix === 'string') {
                formattedMatrix = matrix;
            }
            // 其他情况，尝试转换为字符串
            else {
                formattedMatrix = JSON.stringify(matrix, null, 2);
            }
            
            this.homographyMatrix.textContent = formattedMatrix;
        }
    }
    
    updateLastOperation(operation) {
        if (this.lastOperation) {
            this.lastOperation.textContent = operation;
        }
    }
    
    exportHomographyMatrix() {
        // 检查是否有矩阵数据
        if (!this.homographyMatrix || this.homographyMatrix.textContent === '-') {
            alert('单应性矩阵数据不可用，请先进行标定。');
            return;
        }
        
        // 创建导出数据
        const exportData = {
            timestamp: new Date().toISOString(),
            description: '单应性矩阵（从图像到地面坐标的转换）'
        };
        
        // 使用原始矩阵数据（如果可用）
        if (this.rawHomographyMatrix) {
            exportData.homography_matrix = this.rawHomographyMatrix;
        } else {
            // 如果原始数据不可用，使用格式化的文本
            exportData.homography_matrix = this.homographyMatrix.textContent;
        }
        
        // 添加矩阵的格式化文本表示
        exportData.formatted_matrix = this.homographyMatrix.textContent;
        
        // 将数据转换为JSON格式
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `homography_matrix_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
        
        console.log('已导出单应性矩阵');
        this.updateLastOperation('导出单应性矩阵');
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Sending message:', data);
            this.ws.send(JSON.stringify(data));
            
            // 更新最后操作信息
            if (this.lastOperation) {
                this.lastOperation.textContent = `发送命令: ${data.command}`;
            }
        } else {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket未连接');
        }
    }
    
    // 统一的图像帧显示方法
    displayImageFrame(blob) {
        const url = URL.createObjectURL(blob);
        
        // 创建临时图像对象来加载blob
        const tempImg = new Image();
        
        tempImg.onload = () => {
            // 清理之前的URL
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
            }
            
            // 直接设置img元素的src
            this.video.src = url;
            this.currentBlobUrl = url;
            
            // 更新帧计数和时间
            this.frameCount++;
            const now = performance.now();
            this.frameTimes.push(now);
            this.latency = now - this.lastFrameTime;
            this.lastFrameTime = now;
            
            // 延迟清理URL，确保图像有时间显示
            setTimeout(() => {
                if (this.currentBlobUrl === url) {
                    URL.revokeObjectURL(url);
                    this.currentBlobUrl = null;
                }
            }, 100);
        };
        
        tempImg.onerror = () => {
            console.error('Failed to load image frame');
            URL.revokeObjectURL(url);
        };
        
        // 开始加载
        tempImg.src = url;
    }
}

// 当文档加载完成时初始化
document.addEventListener('DOMContentLoaded', () => {
    window.videoStream = new VideoStream();
});
