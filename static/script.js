console.log('Script.js loaded!');
console.log('Document readyState:', document.readyState);

class VideoStream {
    constructor() {
        console.log('VideoStream constructor called');
        
        // Basic elements
        this.video = document.getElementById('video');
        this.statusElement = document.getElementById('status');
        this.fpsElement = document.getElementById('fps');
        this.resolutionElement = document.getElementById('resolution');
        this.latencyElement = document.getElementById('latency');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        
        // Debug related elements
        this.debugToggle = document.getElementById('debugToggle');
        this.debugInfo = document.getElementById('debugInfo');
        this.homographyMatrix = document.getElementById('homographyMatrix');
        this.lastOperation = document.getElementById('lastOperation');
        this.detectedMarkersCount = document.getElementById('detectedMarkersCount');
        this.exportMatrixBtn = document.getElementById('exportMatrixBtn');
        
        // Camera calibration related elements
        this.toggleCameraCalibrationBtn = document.getElementById('toggleCameraCalibrationBtn');
        this.addCalibrationImageBtn = document.getElementById('addCalibrationImageBtn');
        this.performCameraCalibrationBtn = document.getElementById('performCameraCalibrationBtn');
        this.saveCameraCalibrationBtn = document.getElementById('saveCameraCalibrationBtn');
        this.boardWidthInput = document.getElementById('boardWidthInput');
        this.boardHeightInput = document.getElementById('boardHeightInput');
        this.squareSizeInput = document.getElementById('squareSizeInput');
        this.setBoardSizeBtn = document.getElementById('setBoardSizeBtn');
        this.calibrationErrorDisplay = document.getElementById('calibrationErrorDisplay');
        this.savedImagesCount = document.getElementById('savedImagesCount');
        
        // Automatic capture related elements
        this.autoCaptureTimeInput = document.getElementById('autoCaptureTimeInput');
        this.autoCaptureIntervalInput = document.getElementById('autoCaptureIntervalInput');
        this.startAutoCalibrationBtn = document.getElementById('startAutoCalibrationBtn');
        this.stopAutoCalibrationBtn = document.getElementById('stopAutoCalibrationBtn');
        
        // Initialize variables
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
        
        // Camera calibration related status
        this.cameraCalibrationMode = false;
        this.cameraCalibrated = false;
        this.calibrationImages = 0;
        
        // Media display related
        this.currentBlobUrl = null;
        
        // Initialize
        this.initialize();
    }
    
    initialize() {
        // Bind methods to current instance
        this.toggleCameraCalibrationMode = this.toggleCameraCalibrationMode.bind(this);
        
        this.setupEventListeners();
        this.connect();
        
        // Start FPS counter
        setInterval(() => this.updateFps(), 1000);
    }
    
    setupEventListeners() {
        // Start button
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                this.start();
            });
        }
        
        // Stop button
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }
        
        // Fullscreen button
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // Debug information switch
        if (this.debugToggle) {
            this.debugToggle.addEventListener('change', () => {
                if (this.debugInfo) {
                    this.debugInfo.style.display = this.debugToggle.checked ? 'block' : 'none';
                }
            });
        }
        
        // Export matrix button
        if (this.exportMatrixBtn) {
            this.exportMatrixBtn.addEventListener('click', () => {
                this.exportHomographyMatrix();
            });
        }
        
        // Camera calibration related event listeners
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
        // Create WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Attempting to connect WebSocket:', wsUrl);
        console.log('Current location:', window.location);
        
        this.updateStatus('connecting', 'Connecting WebSocket...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.connected = true;
            this.updateStatus('connected', window.i18n ? window.i18n.t('connected') : 'Connected');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
        };
        
        this.ws.onclose = (event) => {
            console.log('WebSocket connection closed:', event);
            console.log('Close code:', event.code, 'Reason:', event.reason);
            this.connected = false;
            this.updateStatus('error', window.i18n ? window.i18n.t('disconnected') : 'Connection disconnected');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = true;
            
            // Try to reconnect after 5 seconds
            setTimeout(() => {
                console.log('Trying to reconnect...');
                this.connect();
            }, 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('error', window.i18n ? window.i18n.t('websocket_error') : 'WebSocket connection error');
        };
        
        this.ws.onmessage = (event) => {
            try {
                console.log('WebSocket message received, type:', typeof event.data, 'instanceof Blob:', event.data instanceof Blob);
                
                // If message is binary data (image frame)
                if (event.data instanceof Blob) {
                    console.log('Processing binary frame data');
                    this.displayImageFrame(event.data);
                } else if (typeof event.data === 'string') {
                    // Parse JSON message
                    console.log('Processing text message:', event.data);
                    const message = JSON.parse(event.data);
                    
                    if (message.type === 'camera_calibration_status') {
                        this.handleCameraCalibrationStatus(message);
                    } else if (message.type === 'frame_info') {
                        this.handleFrameInfo(message);
                    } else {
                        this.handleTextMessage(event.data);
                    }
                } else {
                    console.log('Unknown message type:', typeof event.data);
                }
            } catch (e) {
                console.error('Error processing message:', e);
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
                const text = window.i18n ? 
                    `${window.i18n.t('current_image_count')}: ${this.calibrationImages}` : 
                    `Current image count: ${this.calibrationImages}`;
                this.lastOperation.textContent = text;
            }
            
            // 更新保存的图片计数显示
            if (this.savedImagesCount) {
                const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                    `${this.calibrationImages} 张` : 
                    `${this.calibrationImages} images`;
                this.savedImagesCount.textContent = countText;
            }
        }
        
        if (message.error !== undefined) {
            this.calibrationErrorDisplay.textContent = message.error.toFixed(2) + ' 像素';
        }
        
        // 使用新的UI更新方法
        this.updateCameraCalibrationUIWithStates();
        
        // 停止处理状态
        this.setButtonState(this.toggleCameraCalibrationBtn, this.cameraCalibrationMode ? 'active' : '');
        this.setButtonState(this.performCameraCalibrationBtn, '');
        
        // Display corresponding status message
        if (message.success !== undefined) {
            this.updateStatus(message.success ? 'success' : 'error', 
                            message.success ? 'Operation successful' : 'Operation failed');
        }
    }
    
    handleTextMessage(message) {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);
            
            if (data.type === 'status') {
                this.updateStatus(data.status, data.message);
            } else if (data.type === 'error') {
                console.error('Server error:', data.message);
                this.updateStatus('error', `Error: ${data.message}`);
                this.updateLastOperation(`Error: ${data.message}`);
            } else if (data.type === 'frame_info') {
                // Update resolution display
                if (this.resolutionElement) {
                    this.resolutionElement.textContent = `${data.width}×${data.height}`;
                }
            } else if (data.type === 'camera_info') {
                // 处理相机信息，包括棋盘格参数
                console.log('Received camera info:', data);
                
                // 更新棋盘格参数输入框
                if (data.board_width && this.boardWidthInput) {
                    this.boardWidthInput.value = data.board_width;
                }
                if (data.board_height && this.boardHeightInput) {
                    this.boardHeightInput.value = data.board_height;
                }
                if (data.square_size && this.squareSizeInput) {
                    this.squareSizeInput.value = data.square_size;
                }
                
                // 更新分辨率信息
                if (this.resolutionElement && data.current_width && data.current_height) {
                    this.resolutionElement.textContent = `${data.current_width}×${data.current_height}`;
                }
            } else if (data.type === 'calibration_result') {
                // Process calibration result
                console.log('Received calibration result:', data);
                
                if (data.success) {
                    this.calibrated = true;
                    
                    // Update homography matrix display
                    if (data.homography_matrix) {
                        this.updateHomographyMatrix(data.homography_matrix);
                        this.updateLastOperation('Calibration successful, homography matrix updated');
                    }
                }
            } else if (data.type === 'camera_calibration_status') {
                this.cameraCalibrationMode = data.calibration_mode;
                this.cameraCalibrated = data.calibrated;
                this.calibrationImages = data.image_count;
                this.updateCameraCalibrationUI();
                
                if (data.error !== undefined) {
                    this.calibrationErrorDisplay.textContent = data.error.toFixed(2) + ' pixels';
                }
                
                // 如果包含棋盘格参数，更新输入框
                if (data.width && this.boardWidthInput) {
                    this.boardWidthInput.value = data.width;
                }
                if (data.height && this.boardHeightInput) {
                    this.boardHeightInput.value = data.height;
                }
                if (data.square_size && this.squareSizeInput) {
                    // 转换为毫米显示
                    this.squareSizeInput.value = Math.round(data.square_size * 1000);
                }
            } else if (data.type === 'auto_capture_status') {
                // 处理自动采集状态消息
                console.log('Received auto capture status:', data);
                
                if (data.started !== undefined) {
                    if (data.started) {
                        this.updateStatus('success', window.i18n ? 
                            window.i18n.t('auto_capture_started', {duration: data.duration, interval: data.interval}) : 
                            `Auto capture started for ${data.duration}s with ${data.interval}ms interval`);
                        
                        // 设置自动采集按钮状态
                        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
                        this.stopAutoCalibrationBtn.disabled = false;
                    } else {
                        this.updateStatus('error', window.i18n ? 
                            window.i18n.t('auto_capture_failed') : 
                            'Failed to start auto capture');
                    }
                }
                
                if (data.stopped !== undefined) {
                    if (data.stopped) {
                        this.updateStatus('success', window.i18n ? 
                            window.i18n.t('auto_capture_stopped') : 
                            'Auto capture stopped');
                        
                        // 恢复按钮状态
                        this.setButtonState(this.startAutoCalibrationBtn, '');
                        this.stopAutoCalibrationBtn.disabled = true;
                    }
                }
            } else if (data.type === 'auto_capture_completed') {
                // 处理自动采集完成消息
                console.log('Auto capture completed:', data);
                
                this.updateStatus('success', window.i18n ? 
                    window.i18n.t('auto_capture_completed', {
                        success: data.success_count, 
                        total: data.attempt_count
                    }) : 
                    `Auto capture completed: ${data.success_count} successful out of ${data.attempt_count} attempts`);
                
                // 更新标定图像计数
                this.calibrationImages = data.image_count;
                this.updateCameraCalibrationUI();
                
                // 恢复按钮状态
                this.setButtonState(this.startAutoCalibrationBtn, '');
                this.stopAutoCalibrationBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error processing text message:', error);
        }
    }
    
    handleBinaryMessage(data) {
        try {
            // Process binary message (video frame)
            const blob = new Blob([data], { type: 'image/jpeg' });
            this.displayImageFrame(blob);
        } catch (error) {
            console.error('Error processing binary message:', error);
        }
    }
    
    updateStatus(status, message) {
        if (this.statusElement) {
            this.statusElement.textContent = message || status;
            this.statusElement.className = `status ${status}`;
        }
    }
    
    updateFps() {
        // Calculate FPS
        const fps = this.frameCount - this.lastFrameCount;
        this.lastFrameCount = this.frameCount;
        this.fps = fps;
        
        // Update FPS display
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
                console.error(`Unable to enter full screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    toggleCalibrationMode() {
        console.log('Switching calibration mode');
        
        // Switch calibration mode status
        this.calibrationMode = !this.calibrationMode;
        
        // Update UI
        if (this.toggleCalibrationBtn) {
            this.toggleCalibrationBtn.textContent = this.calibrationMode ? 'Exit calibration mode' : 'Enter calibration mode';
        }
        
        // Show/hide calibration panel
        if (this.calibrationPanel) {
            this.calibrationPanel.style.display = this.calibrationMode ? 'block' : 'none';
        }
        
        // Show/hide coordinate test panel
        if (this.coordinateTestPanel) {
            this.coordinateTestPanel.style.display = this.calibrated && !this.calibrationMode ? 'block' : 'none';
        }
        
        // Send switch calibration mode command to server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'toggle_calibration_mode'
            }));
        }
        
        // Update status
        this.updateStatus(this.calibrationMode ? 'info' : 'success', 
                         this.calibrationMode ? 'Entered calibration mode' : 'Exited calibration mode');
    }
    
    toggleCameraCalibrationMode() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.toggleCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'toggle_camera_calibration_mode'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        // Update last operation information
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Switching camera calibration mode';
        }
    }
    
    addCalibrationImage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.addCalibrationImageBtn, 'processing');
        
        const message = {
            action: 'add_calibration_image'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Capturing calibration image';
        }
        
        // 2秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.addCalibrationImageBtn, '');
        }, 2000);
    }
    
    performCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.performCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'perform_camera_calibration'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Performing camera calibration';
        }
    }
    
    saveCameraCalibration() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.saveCameraCalibrationBtn, 'processing');
        
        const message = {
            action: 'save_camera_calibration'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Saving calibration result';
        }
        
        // 2秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.saveCameraCalibrationBtn, '');
        }, 2000);
    }
    
    setBoardSize() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        const width = parseInt(this.boardWidthInput.value);
        const height = parseInt(this.boardHeightInput.value);
        const squareSize = parseFloat(this.squareSizeInput.value) / 1000; // Convert to meters
        
        if (isNaN(width) || isNaN(height) || isNaN(squareSize)) {
            alert('Please enter valid chessboard parameters!');
            return;
        }
        
        // 设置处理状态
        this.setButtonState(this.setBoardSizeBtn, 'processing');
        
        const message = {
            action: 'set_board_size',
            width: width,
            height: height,
            square_size: squareSize
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            this.lastOperation.textContent = 'Setting chessboard parameters';
        }
        
        // 1秒后恢复按钮状态
        setTimeout(() => {
            this.setButtonState(this.setBoardSizeBtn, '');
        }, 1000);
    }
    
    handleServerMessage(message) {
        // Process camera calibration related messages
        if (message.type === 'camera_calibration_status') {
            this.cameraCalibrationMode = message.calibration_mode;
            this.cameraCalibrated = message.calibrated;
            this.calibrationImages = message.image_count;
            this.updateCameraCalibrationUI();
            
            if (message.error !== undefined) {
                this.calibrationErrorDisplay.textContent = message.error.toFixed(2) + ' pixels';
            }
        }
    }
    
    updateCameraCalibrationUI() {
        // 切换按钮状态
        this.setButtonState(this.toggleCameraCalibrationBtn, this.cameraCalibrationMode ? 'active' : '');
        
        // 更新按钮文本 - 修改data-i18n属性而不是innerHTML
        if (this.toggleCameraCalibrationBtn) {
            const newKey = this.cameraCalibrationMode ? 'exit_calibration_mode' : 'camera_calibration_mode';
            this.toggleCameraCalibrationBtn.setAttribute('data-i18n', newKey);
            
            // 立即应用语言
            if (window.i18n) {
                const span = this.toggleCameraCalibrationBtn.querySelector('span');
                if (span) {
                    span.textContent = window.i18n.t(newKey);
                }
            }
        }
        
        // 启用/禁用相关按钮
        if (this.addCalibrationImageBtn) {
            this.addCalibrationImageBtn.disabled = !this.cameraCalibrationMode;
        }
        
        if (this.performCameraCalibrationBtn) {
            this.performCameraCalibrationBtn.disabled = !this.cameraCalibrationMode || this.calibrationImages < 10;
        }
        
        if (this.saveCameraCalibrationBtn) {
            this.saveCameraCalibrationBtn.disabled = !this.cameraCalibrated;
        }
        
        // 更新自动采集按钮状态
        if (this.startAutoCalibrationBtn) {
            this.startAutoCalibrationBtn.disabled = !this.cameraCalibrationMode;
        }
        
        if (this.stopAutoCalibrationBtn) {
            this.stopAutoCalibrationBtn.disabled = true; // 默认禁用，只有在自动采集开始后才启用
        }
        
        // 设置其他按钮状态
        if (this.saveCameraCalibrationBtn) {
            this.setButtonState(this.saveCameraCalibrationBtn, this.cameraCalibrated ? 'active' : '');
        }
        
        // 显示图像数量信息
        if (this.cameraCalibrationMode && this.lastOperation) {
            const message = window.i18n ? 
                `${window.i18n.t('current_image_count')}: ${this.calibrationImages}` :
                `Current image count: ${this.calibrationImages}`;
            this.lastOperation.textContent = message;
        }
        
        // 更新保存的图片计数显示
        if (this.savedImagesCount) {
            const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                `${this.calibrationImages} 张` : 
                `${this.calibrationImages} images`;
            this.savedImagesCount.textContent = countText;
        }
    }
    
    // 按钮状态管理方法
    setButtonState(button, state) {
        if (!button) return;
        
        // 移除所有状态类
        button.classList.remove('active', 'processing');
        
        // 添加新状态
        if (state === 'active') {
            button.classList.add('active');
        } else if (state === 'processing') {
            button.classList.add('processing');
        }
    }
    
    // 更新相机标定UI状态
    updateCameraCalibrationUIWithStates() {
        // 切换按钮状态
        this.setButtonState(this.toggleCameraCalibrationBtn, this.cameraCalibrationMode ? 'active' : '');
        
        // 更新按钮文本 - 修改data-i18n属性而不是innerHTML
        if (this.toggleCameraCalibrationBtn) {
            const newKey = this.cameraCalibrationMode ? 'exit_calibration_mode' : 'camera_calibration_mode';
            this.toggleCameraCalibrationBtn.setAttribute('data-i18n', newKey);
            
            // 立即应用语言
            if (window.i18n) {
                const span = this.toggleCameraCalibrationBtn.querySelector('span');
                if (span) {
                    span.textContent = window.i18n.t(newKey);
                }
            }
        }
        
        // 启用/禁用相关按钮
        this.addCalibrationImageBtn.disabled = !this.cameraCalibrationMode;
        this.performCameraCalibrationBtn.disabled = !this.cameraCalibrationMode || this.calibrationImages < 10;
        this.saveCameraCalibrationBtn.disabled = !this.cameraCalibrated;
        
        // 设置其他按钮状态
        this.setButtonState(this.saveCameraCalibrationBtn, this.cameraCalibrated ? 'active' : '');
        
        // 显示图像数量信息
        if (this.cameraCalibrationMode && this.lastOperation) {
            const message = window.i18n ? 
                `${window.i18n.t('current_image_count')}: ${this.calibrationImages}` :
                `Current image count: ${this.calibrationImages}`;
            this.lastOperation.textContent = message;
        }
        
        // 更新保存的图片计数显示
        if (this.savedImagesCount) {
            const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                `${this.calibrationImages} 张` : 
                `${this.calibrationImages} images`;
            this.savedImagesCount.textContent = countText;
        }
    }
    
    updateHomographyMatrix(matrix) {
        if (this.homographyMatrix && matrix) {
            // Save original matrix data for export
            this.rawHomographyMatrix = matrix;
            
            // Format matrix display
            let formattedMatrix = '';
            
            // Check matrix format (1D array of length 9)
            if (Array.isArray(matrix) && matrix.length === 9) {
                for (let i = 0; i < 3; i++) {
                    let row = [];
                    for (let j = 0; j < 3; j++) {
                        row.push(matrix[i*3 + j].toFixed(4));
                    }
                    formattedMatrix += row.join('  ') + '\n';
                }
            } 
            // If 3x3 matrix format
            else if (Array.isArray(matrix) && matrix.length === 3 && Array.isArray(matrix[0])) {
                for (let i = 0; i < 3; i++) {
                    let row = [];
                    for (let j = 0; j < 3; j++) {
                        row.push(matrix[i][j].toFixed(4));
                    }
                    formattedMatrix += row.join('  ') + '\n';
                }
            }
            // If string format, display directly
            else if (typeof matrix === 'string') {
                formattedMatrix = matrix;
            }
            // Other cases, try to convert to string
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
        // Check if there is matrix data
        if (!this.homographyMatrix || this.homographyMatrix.textContent === '-') {
            alert('Homography matrix data not available, please perform calibration first.');
            return;
        }
        
        // Create export data
        const exportData = {
            timestamp: new Date().toISOString(),
            description: 'Homography matrix (from image to ground coordinates)'
        };
        
        // Use original matrix data (if available)
        if (this.rawHomographyMatrix) {
            exportData.homography_matrix = this.rawHomographyMatrix;
        } else {
            // If original data not available, use formatted text
            exportData.homography_matrix = this.homographyMatrix.textContent;
        }
        
        // Add formatted text representation of the matrix
        exportData.formatted_matrix = this.homographyMatrix.textContent;
        
        // Convert data to JSON format
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Create Blob object
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `homography_matrix_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
        
        console.log('Homography matrix exported');
        this.updateLastOperation('Exported homography matrix');
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('Sending message:', data);
            this.ws.send(JSON.stringify(data));
            
            // Update last operation information
            if (this.lastOperation) {
                this.lastOperation.textContent = `Sent command: ${data.command}`;
            }
        } else {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
        }
    }
    
    // Unified image frame display method
    displayImageFrame(blob) {
        try {
            console.log('Received video frame, size:', blob.size, 'bytes');
            
            // Clean up previous URL
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
            }
            
            // Create new blob URL
            const url = URL.createObjectURL(blob);
            this.currentBlobUrl = url;
            
            // Directly set to img element
            if (this.video) {
                this.video.onload = () => {
                    console.log('Frame loaded successfully');
                    // Update frame count and time
                    this.frameCount++;
                    const now = performance.now();
                    this.latency = now - this.lastFrameTime;
                    this.lastFrameTime = now;
                    
                    // Update latency display
                    if (this.latencyElement) {
                        this.latencyElement.textContent = `${Math.round(this.latency)} ms`;
                    }
                    
                    // Update resolution display
                    if (this.resolutionElement && this.video.naturalWidth && this.video.naturalHeight) {
                        this.resolutionElement.textContent = `${this.video.naturalWidth}×${this.video.naturalHeight}`;
                    }
                };
                
                this.video.onerror = (e) => {
                    console.error('Failed to load video frame:', e);
                };
                
                this.video.src = url;
            } else {
                console.error('Video element not found');
            }
            
        } catch (error) {
            console.error('Error in displayImageFrame:', error);
        }
    }

    // 添加自动采集方法
    startAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 获取参数
        const duration = parseInt(this.autoCaptureTimeInput.value) || 10;
        const interval = parseInt(this.autoCaptureIntervalInput.value) || 500;
        
        // 设置处理状态
        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
        
        const message = {
            action: 'start_auto_calibration_capture',
            duration: duration,
            interval: interval
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('starting_auto_capture', {duration: duration, interval: interval}) : 
                `Starting auto capture for ${duration}s with ${interval}ms interval`;
            this.lastOperation.textContent = text;
        }
    }

    stopAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        const message = {
            action: 'stop_auto_calibration_capture'
        };
        
        console.log('Sending message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('stopping_auto_capture') : 
                'Stopping auto capture';
            this.lastOperation.textContent = text;
        }
    }
}

// When document is loaded, initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired!');
    console.log('Creating VideoStream instance...');
    window.videoStream = new VideoStream();
    console.log('VideoStream instance created:', window.videoStream);
});

console.log('Script.js file completely loaded!');
