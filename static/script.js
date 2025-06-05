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
        this.loadCameraCalibrationBtn = document.getElementById('loadCameraCalibrationBtn');
        this.boardWidthInput = document.getElementById('boardWidthInput');
        this.boardHeightInput = document.getElementById('boardHeightInput');
        this.squareSizeInput = document.getElementById('squareSizeInput');
        this.setBoardSizeBtn = document.getElementById('setBoardSizeBtn');
        this.blurKernelSizeInput = document.getElementById('blurKernelSizeInput');
        this.qualityCheckLevelInput = document.getElementById('qualityCheckLevelInput');
        this.calibrationErrorDisplay = document.getElementById('calibrationErrorDisplay');
        this.savedImagesCount = document.getElementById('savedImagesCount');
        this.currentSessionImagesCount = document.getElementById('currentSessionImagesCount');
        
        // Session management buttons

        
        // Automatic capture related elements
        this.autoCaptureTimeInput = document.getElementById('autoCaptureTimeInput');
        this.autoCaptureIntervalInput = document.getElementById('autoCaptureIntervalInput');
        this.startAutoCalibrationBtn = document.getElementById('startAutoCalibrationBtn');
        this.stopAutoCalibrationBtn = document.getElementById('stopAutoCalibrationBtn');
        
        // Countdown display elements
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.remainingTime = document.getElementById('remainingTime');
        this.nextCaptureTime = document.getElementById('nextCaptureTime');
        this.captureProgress = document.getElementById('captureProgress');
        
        // 倒计时相关变量
        this.countdownInterval = null;
        this.countdownStartTime = null;
        this.countdownDuration = null;
        this.countdownIntervalMs = null;
        this.lastCaptureTime = null;
        
        // 添加新的分辨率显示元素
        this.displayResolution = document.getElementById('displayResolution');
        this.detectionResolution = document.getElementById('detectionResolution');
        this.performanceMode = document.getElementById('performanceMode');
        
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
        
        // 调试模式 - 设置为 false 减少日志输出
        this.debugMode = false;
        
        // 添加快捷键支持 (Ctrl+Shift+D 切换调试模式)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.debugMode = !this.debugMode;
                console.log(`🔧 [DEBUG] Debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'} (Ctrl+Shift+D)`);
                if (this.debugToggle) {
                    this.debugToggle.checked = this.debugMode;
                    if (this.debugInfo) {
                        this.debugInfo.style.display = this.debugMode ? 'block' : 'none';
                    }
                }
            }
        });
        
        // Camera calibration related status
        this.cameraCalibrationMode = false;
        this.cameraCalibrated = false;
        this.calibrationImages = 0;
        this.currentSessionImages = 0;
        
        // Auto capture countdown related
        this.autoCaptureStartTime = null;
        this.autoCaptureEndTime = null;
        this.autoCaptureIntervalMs = 500;
        
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
        
        // 初始化按钮状态 - 确保自动采集按钮在标定模式关闭时被禁用
        this.updateCameraCalibrationUIWithStates();
        
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
                // 同时控制调试模式日志输出
                this.debugMode = this.debugToggle.checked;
                console.log(`🔧 [DEBUG] Debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
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
        
        if (this.loadCameraCalibrationBtn) {
            this.loadCameraCalibrationBtn.addEventListener('click', () => {
                this.loadCameraCalibration();
            });
        }
        
        if (this.setBoardSizeBtn) {
            this.setBoardSizeBtn.addEventListener('click', () => {
                this.setBoardSize();
            });
        }
        
        // Auto capture related event listeners
        if (this.startAutoCalibrationBtn) {
            this.startAutoCalibrationBtn.addEventListener('click', () => {
                this.startAutoCalibrationCapture();
            });
        }
        
        if (this.stopAutoCalibrationBtn) {
            this.stopAutoCalibrationBtn.addEventListener('click', () => {
                this.stopAutoCalibrationCapture();
            });
        }
        
        // Session management event listeners


        // 绑定相机校正开关事件
        this.enableCameraCorrectionToggle = document.getElementById('enableCameraCorrectionToggle');
        this.correctionStatus = document.getElementById('correctionStatus');
        
        if (this.enableCameraCorrectionToggle) {
            this.enableCameraCorrectionToggle.addEventListener('change', (e) => {
                this.toggleCameraCorrection(e.target.checked);
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
            console.log('✅ [WEBSOCKET] Connection established successfully');
            this.connected = true;
            this.updateStatus('connected', window.i18n ? window.i18n.t('connected') : 'Connected');
            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            
            // 连接成功后立即请求当前标定状态
            console.log('📋 [STATUS] Requesting current calibration status...');
            this.requestCurrentStatus();
            
            // 再次在500ms后请求状态，确保同步
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    console.log('📋 [STATUS] Requesting status again (sync check)...');
                    this.requestCurrentStatus();
                }
            }, 500);
        };
        
        this.ws.onclose = (event) => {
            console.log('❌ [WEBSOCKET] Connection closed - Code:', event.code, 'Reason:', event.reason);
            this.connected = false;
            this.updateStatus('error', window.i18n ? window.i18n.t('disconnected') : 'Connection disconnected');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = true;
            
            // Try to reconnect after 5 seconds
            setTimeout(() => {
                console.log('🔄 [WEBSOCKET] Attempting to reconnect...');
                this.connect();
            }, 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ [WEBSOCKET] Connection error:', error);
            this.updateStatus('error', window.i18n ? window.i18n.t('websocket_error') : 'WebSocket connection error');
        };
        
        this.ws.onmessage = (event) => {
            try {
                // If message is binary data (image frame)
                if (event.data instanceof Blob) {
                    // 视频帧不记录日志，避免刷屏
                    this.displayImageFrame(event.data);
                } else if (typeof event.data === 'string') {
                    // Parse JSON message
                    try {
                        const message = JSON.parse(event.data);
                        
                        // 专门为棋盘格标定调试记录关键信息
                        if (message.type === 'camera_calibration_status') {
                            console.log('🎯 [CALIBRATION DEBUG] Status update:', {
                                calibration_mode: message.calibration_mode,
                                current_session_count: message.current_session_count,
                                saved_count: message.saved_count,
                                calibrated: message.calibrated,
                                auto_capture_progress: message.auto_capture_progress
                            });
                            this.handleCameraCalibrationStatus(message);
                        } else if (message.type === 'auto_capture_started') {
                            console.log('🚀 [AUTO CAPTURE] Started:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'auto_capture_stopped') {
                            console.log('🛑 [AUTO CAPTURE] Stopped:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'chessboard_detected') {
                            console.log('♟️ [CHESSBOARD] Detected and saved:', message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'error') {
                            console.error('❌ [ERROR]', message.message);
                            this.handleTextMessage(event.data);
                        } else if (message.type === 'frame_info') {
                            // frame_info 静默处理
                            this.handleFrameInfo(message);
                        } else {
                            // 其他消息类型简化记录
                            if (this.debugMode) {
                                console.log('📝 Message type:', message.type, message);
                            }
                            this.handleTextMessage(event.data);
                        }
                    } catch (parseError) {
                        console.error('❌ Error parsing JSON message:', parseError);
                        console.log('Raw message data:', event.data);
                    }
                } else {
                    console.log('❓ Unknown message type:', typeof event.data);
                }
            } catch (e) {
                console.error('💥 Error processing message:', e);
                console.log('Event data:', event.data);
            }
        };
    }
    
    handleCameraCalibrationStatus(message) {
        this.cameraCalibrationMode = message.calibration_mode;
        this.cameraCalibrated = message.calibrated;
        
        // 更新当前会话图片计数
        if (message.image_count !== undefined || message.current_session_count !== undefined) {
            const oldCount = this.currentSessionImages;
            this.currentSessionImages = message.current_session_count !== undefined ? 
                message.current_session_count : message.image_count;
            
            if (oldCount !== this.currentSessionImages) {
                console.log(`📈 [IMAGE COUNT] Session images: ${oldCount} → ${this.currentSessionImages}`);
            }
            
            if (this.currentSessionImagesCount) {
                const newText = this.currentSessionImages + ' 张';
                this.currentSessionImagesCount.textContent = newText;
                console.log(`🔄 [UI UPDATE] Current session count displayed: ${newText}`);
            } else {
                console.error('❌ [UI ERROR] currentSessionImagesCount element not found!');
            }
            
            if (this.lastOperation) {
                const text = window.i18n ? 
                    `${window.i18n.t('current_image_count')}: ${this.currentSessionImages}` : 
                    `Current image count: ${this.currentSessionImages}`;
                this.lastOperation.textContent = text;
            }
        }
        
        // 处理已保存图片计数（磁盘上的文件数量）
        if (message.saved_count !== undefined) {
            const savedCount = message.saved_count;
            console.log(`💾 [SAVED COUNT] Disk saved images: ${savedCount}`);
            
            if (this.savedImagesCount) {
                const countText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                    `${savedCount} 张` : 
                    `${savedCount} images`;
                this.savedImagesCount.textContent = countText;
                console.log(`🔄 [UI UPDATE] Saved images count displayed: ${countText}`);
                
                // 添加更新动画
                this.savedImagesCount.classList.add('updated');
                setTimeout(() => {
                    this.savedImagesCount.classList.remove('updated');
                }, 500);
            } else {
                console.error('❌ [UI ERROR] savedImagesCount element not found!');
            }
        }
        
        // 更新标定误差显示
        if (message.error !== undefined && this.calibrationErrorDisplay) {
            const errorText = message.error.toFixed(2) + ' pixels';
            console.log(`📏 [CALIBRATION] Error: ${errorText}`);
            this.calibrationErrorDisplay.textContent = errorText;
        }
        
        // 检查UI元素状态
        console.log(`🔍 [UI DEBUG] Elements check:`, {
            currentSessionImagesCount: !!this.currentSessionImagesCount,
            savedImagesCount: !!this.savedImagesCount,
            calibrationErrorDisplay: !!this.calibrationErrorDisplay
        });
        
        // 更新UI状态
        this.updateCameraCalibrationUIWithStates();
    }
    
    handleFrameInfo(message) {
        // 处理帧信息消息
        if (message.width && message.height && this.resolutionElement) {
            this.resolutionElement.textContent = `${message.width}×${message.height}`;
            if (this.debugMode) {
                console.log(`📐 [FRAME INFO] Resolution: ${message.width}×${message.height}`);
            }
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
                    
                    // 如果是相机标定完成，询问是否要处理图片
                    if (data.calibration_error !== undefined) {
                        this.showCalibrationCleanupDialog(data.calibration_error);
                    }
                }
            } else if (data.type === 'camera_calibration_status') {
                this.handleCameraCalibrationStatus(data);
                
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
                
                // 显示会话消息
                if (data.session_message) {
                    this.updateStatus('info', data.session_message);
                }
                
                // 如果是自动采集过程中的更新，显示特殊提示
                if (data.auto_capture_progress) {
                    console.log('Auto capture progress update: current session =', data.current_session_count);
                    this.updateStatus('success', window.i18n ? 
                        window.i18n.t('auto_capture_image_added', {count: data.current_session_count}) || `已采集 ${data.current_session_count} 张图片` :
                        `Captured ${data.current_session_count} images`);
                }
            } else if (data.type === 'auto_capture_status') {
                // 处理自动采集状态消息
                console.log('Received auto capture status:', data);
                
                if (data.started !== undefined) {
                    if (data.started) {
                        this.updateStatus('success', window.i18n ? 
                            window.i18n.t('auto_capture_started') || '自动采集已开始' : 
                            'Auto capture started');
                        
                        // 设置自动采集按钮状态
                        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
                        this.stopAutoCalibrationBtn.disabled = false;
                        
                        // 如果本地没有启动倒计时，则启动
                        if (!this.countdownInterval && data.duration && data.interval) {
                            this.startCountdown(data.duration, data.interval);
                        }
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
                        
                        // 停止倒计时
                        this.stopCountdown();
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
                this.updateCameraCalibrationUIWithStates();
                
                // 恢复按钮状态
                this.setButtonState(this.startAutoCalibrationBtn, '');
                this.stopAutoCalibrationBtn.disabled = true;
                
                // 停止倒计时
                this.stopCountdown();
                
                // 如果在自动采集过程中收到新图像，更新最后采集时间
                if (this.countdownInterval && data.image_count > this.calibrationImages) {
                    this.lastCaptureTime = Date.now();
                }
            } else if (data.type === 'camera_calibration_saved') {
                // 处理相机标定保存结果
                this.handleCameraCalibrationSaved(data);
            } else if (data.type === 'camera_calibration_loaded') {
                // 处理相机标定加载结果
                this.handleCameraCalibrationLoaded(data);
            } else if (data.type === 'camera_correction_toggled') {
                // 处理相机校正状态切换结果
                this.handleCameraCorrectionToggled(data);
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
    
         handleCameraCalibrationSaved(data) {
         // 恢复按钮状态
         this.setButtonState(this.saveCameraCalibrationBtn, '');
         
         if (data.success) {
             this.updateStatus('success', 'Camera calibration saved successfully');
             
             // 显示详细的标定信息
             this.displayCalibrationResults(data);
         } else {
             this.updateStatus('error', data.error || 'Failed to save camera calibration');
         }
     }
     
     handleCameraCalibrationLoaded(data) {
         // 恢复按钮状态
         this.setButtonState(this.loadCameraCalibrationBtn, '');
         
         if (data.success) {
             this.updateStatus('success', 'Camera calibration loaded successfully');
             
             // 更新UI状态表示已标定
             this.cameraCalibrated = true;
             this.updateCameraCalibrationUIWithStates();
             
             // 启用相机校正开关
             if (this.enableCameraCorrectionToggle) {
                 this.enableCameraCorrectionToggle.disabled = false;
                 this.enableCameraCorrectionToggle.checked = true; // 默认启用校正
                 this.updateCorrectionStatus('active');
             }
             
             // 显示加载的标定信息
             this.displayLoadedCalibrationResults(data);
         } else {
             this.updateStatus('error', data.error || 'Failed to load camera calibration');
         }
     }
    
    displayCalibrationResults(data) {
        // 创建或更新调试信息面板
        let debugPanel = document.getElementById('calibration-debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'calibration-debug-panel';
            debugPanel.className = 'calibration-debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 2px solid #007bff;
                border-radius: 10px;
                padding: 20px;
                max-width: 600px;
                max-height: 70vh;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                font-family: 'Courier New', monospace;
                font-size: 12px;
            `;
            document.body.appendChild(debugPanel);
        }
        
        let html = `
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #007bff; margin: 0;">📊 相机标定结果</h3>
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="position: absolute; top: 10px; right: 15px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
            </div>
            
                         <div style="margin-bottom: 15px;">
                 <h4 style="color: #28a745; margin: 5px 0;">✅ 标定成功完成</h4>
                 <p><strong>标定图像数量:</strong> ${data.image_count} 张</p>
                 <p><strong>重投影误差:</strong> ${data.error.toFixed(4)} 像素</p>
                 <p><strong>标定质量:</strong> <span style="color: ${this.getQualityColor(data.quality)}">${this.getQualityText(data.quality)}</span></p>
                 ${this.getQualityAnalysis(data.error, data.image_count)}
                 <p><strong>保存路径:</strong> <code>${data.filepath}</code></p>
             </div>
        `;
        
        if (data.camera_matrix) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #17a2b8; margin: 5px 0;">📐 相机内参矩阵</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        <table style="margin: 0 auto; border-spacing: 10px;">
                            <tr>
                                <td>${data.camera_matrix[0].toFixed(2)}</td>
                                <td>${data.camera_matrix[1].toFixed(2)}</td>
                                <td>${data.camera_matrix[2].toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[3].toFixed(2)}</td>
                                <td>${data.camera_matrix[4].toFixed(2)}</td>
                                <td>${data.camera_matrix[5].toFixed(2)}</td>
                            </tr>
                            <tr>
                                <td>${data.camera_matrix[6].toFixed(6)}</td>
                                <td>${data.camera_matrix[7].toFixed(6)}</td>
                                <td>${data.camera_matrix[8].toFixed(6)}</td>
                            </tr>
                        </table>
                    </div>
                    <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                        fx=${data.camera_matrix[0].toFixed(1)}, fy=${data.camera_matrix[4].toFixed(1)}, 
                        cx=${data.camera_matrix[2].toFixed(1)}, cy=${data.camera_matrix[5].toFixed(1)}
                    </p>
                </div>
            `;
        }
        
        if (data.distortion_coeffs) {
            html += `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #6f42c1; margin: 5px 0;">🔧 畸变系数</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                        [${data.distortion_coeffs.map(c => c.toFixed(6)).join(', ')}]
                    </div>
                                         <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                         k1=${data.distortion_coeffs[0]?.toFixed(4) || 'N/A'}, 
                         k2=${data.distortion_coeffs[1]?.toFixed(4) || 'N/A'}, 
                         p1=${data.distortion_coeffs[2]?.toFixed(4) || 'N/A'}, 
                         p2=${data.distortion_coeffs[3]?.toFixed(4) || 'N/A'}
                         ${data.distortion_coeffs[4] !== undefined ? `, k3=${data.distortion_coeffs[4].toFixed(4)}` : ''}
                     </p>
                </div>
            `;
        }
        
        html += `
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                    关闭
                </button>
            </div>
        `;
        
                 debugPanel.innerHTML = html;
     }
     
     displayLoadedCalibrationResults(data) {
         // 创建或更新调试信息面板
         let debugPanel = document.getElementById('calibration-debug-panel');
         if (!debugPanel) {
             debugPanel = document.createElement('div');
             debugPanel.id = 'calibration-debug-panel';
             debugPanel.className = 'calibration-debug-panel';
             debugPanel.style.cssText = `
                 position: fixed;
                 top: 50%;
                 left: 50%;
                 transform: translate(-50%, -50%);
                 background: white;
                 border: 2px solid #28a745;
                 border-radius: 10px;
                 padding: 20px;
                 max-width: 600px;
                 max-height: 70vh;
                 overflow-y: auto;
                 z-index: 1000;
                 box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                 font-family: 'Courier New', monospace;
                 font-size: 12px;
             `;
             document.body.appendChild(debugPanel);
         }
         
         let html = `
             <div style="text-align: center; margin-bottom: 15px;">
                 <h3 style="color: #28a745; margin: 0;">📁 相机标定数据已加载</h3>
                 <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                         style="position: absolute; top: 10px; right: 15px; background: #dc3545; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">×</button>
             </div>
             
             <div style="margin-bottom: 15px;">
                 <h4 style="color: #28a745; margin: 5px 0;">✅ 标定数据加载成功</h4>
                 <p><strong>重投影误差:</strong> ${data.error.toFixed(4)} 像素</p>
                 <p><strong>标定质量:</strong> <span style="color: ${this.getQualityColor(data.quality)}">${this.getQualityText(data.quality)}</span></p>
                 <p><strong>文件路径:</strong> <code>${data.filepath}</code></p>
                 <div style="background: #d4edda; padding: 8px; border-radius: 5px; color: #155724; font-size: 11px;">
                     ℹ️ 相机标定已激活，所有视频流和图像处理将自动进行畸变校正
                 </div>
             </div>
         `;
         
         if (data.camera_matrix) {
             html += `
                 <div style="margin-bottom: 15px;">
                     <h4 style="color: #17a2b8; margin: 5px 0;">📐 相机内参矩阵</h4>
                     <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                         <table style="margin: 0 auto; border-spacing: 10px;">
                             <tr>
                                 <td>${data.camera_matrix[0].toFixed(2)}</td>
                                 <td>${data.camera_matrix[1].toFixed(2)}</td>
                                 <td>${data.camera_matrix[2].toFixed(2)}</td>
                             </tr>
                             <tr>
                                 <td>${data.camera_matrix[3].toFixed(2)}</td>
                                 <td>${data.camera_matrix[4].toFixed(2)}</td>
                                 <td>${data.camera_matrix[5].toFixed(2)}</td>
                             </tr>
                             <tr>
                                 <td>${data.camera_matrix[6].toFixed(6)}</td>
                                 <td>${data.camera_matrix[7].toFixed(6)}</td>
                                 <td>${data.camera_matrix[8].toFixed(6)}</td>
                             </tr>
                         </table>
                     </div>
                     <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                         fx=${data.camera_matrix[0].toFixed(1)}, fy=${data.camera_matrix[4].toFixed(1)}, 
                         cx=${data.camera_matrix[2].toFixed(1)}, cy=${data.camera_matrix[5].toFixed(1)}
                     </p>
                 </div>
             `;
         }
         
         if (data.distortion_coeffs) {
             html += `
                 <div style="margin-bottom: 15px;">
                     <h4 style="color: #6f42c1; margin: 5px 0;">🔧 畸变系数</h4>
                     <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                         [${data.distortion_coeffs.map(c => c.toFixed(6)).join(', ')}]
                     </div>
                     <p style="font-size: 11px; color: #6c757d; margin-top: 5px;">
                         k1=${data.distortion_coeffs[0]?.toFixed(4) || 'N/A'}, 
                         k2=${data.distortion_coeffs[1]?.toFixed(4) || 'N/A'}, 
                         p1=${data.distortion_coeffs[2]?.toFixed(4) || 'N/A'}, 
                         p2=${data.distortion_coeffs[3]?.toFixed(4) || 'N/A'}
                         ${data.distortion_coeffs[4] !== undefined ? `, k3=${data.distortion_coeffs[4].toFixed(4)}` : ''}
                     </p>
                 </div>
             `;
         }
         
         html += `
             <div style="text-align: center; margin-top: 20px;">
                 <button onclick="document.getElementById('calibration-debug-panel').remove()" 
                         style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                     关闭
                 </button>
             </div>
         `;
         
         debugPanel.innerHTML = html;
     }
     
     getQualityColor(quality) {
        switch(quality) {
            case 'EXCELLENT': return '#28a745';
            case 'GOOD': return '#007bff';
            case 'NEEDS_IMPROVEMENT': return '#ffc107';
            default: return '#6c757d';
        }
    }
    
         getQualityText(quality) {
         switch(quality) {
             case 'EXCELLENT': return '🌟 优秀';
             case 'GOOD': return '👍 良好';
             case 'NEEDS_IMPROVEMENT': return '⚠️ 需要改进';
             default: return '❓ 未知';
         }
     }
     
     loadCameraCalibration() {
         if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
             console.error('WebSocket not connected');
             this.updateStatus('error', 'WebSocket not connected');
             return;
         }
         
         // 设置处理状态
         this.setButtonState(this.loadCameraCalibrationBtn, 'processing');
         
         const message = {
             action: 'load_camera_calibration'
         };
         
         console.log('Sending message:', message);
         this.ws.send(JSON.stringify(message));
         
         if (this.lastOperation) {
             this.lastOperation.textContent = 'Loading calibration data';
         }
         
         // 3秒后恢复按钮状态
         setTimeout(() => {
             this.setButtonState(this.loadCameraCalibrationBtn, '');
         }, 3000);
     }
     
     getQualityAnalysis(error, imageCount) {
         let analysis = '<div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; font-size: 11px;">';
         analysis += '<strong>📋 质量分析:</strong><br>';
         
         // 误差分析
         if (error < 1.0) {
             analysis += '• <span style="color: #28a745;">误差优秀</span>: 适用于高精度测量应用<br>';
         } else if (error < 2.0) {
             analysis += '• <span style="color: #007bff;">误差良好</span>: 适用于一般工业应用<br>';
         } else {
             analysis += '• <span style="color: #dc3545;">误差偏高</span>: 建议重新标定以提高精度<br>';
             analysis += '• <strong>改进建议:</strong> 确保图像清晰、光照均匀、拍摄角度多样化<br>';
         }
         
         // 图像数量分析
         if (imageCount >= 20) {
             analysis += '• <span style="color: #28a745;">图像数量充足</span>: ' + imageCount + '张图像能够提供良好的标定基础<br>';
         } else if (imageCount >= 10) {
             analysis += '• <span style="color: #ffc107;">图像数量适中</span>: ' + imageCount + '张图像基本满足标定需求<br>';
         } else {
             analysis += '• <span style="color: #dc3545;">图像数量偏少</span>: 建议增加到15-25张图像<br>';
         }
         
         // 使用建议
         if (error > 2.0) {
             analysis += '• <strong>🔧 改进方案:</strong><br>';
             analysis += '  - 重新拍摄更清晰的标定图像<br>';
             analysis += '  - 确保棋盘格完全在视野内<br>';
             analysis += '  - 增加不同角度和距离的图像<br>';
             analysis += '  - 检查相机是否稳定，避免运动模糊<br>';
         }
         
         analysis += '</div>';
         return analysis;
     }
    
    setBoardSize() {
        const width = parseInt(this.boardWidthInput.value) || 8;
        const height = parseInt(this.boardHeightInput.value) || 5;
        const squareSize = (parseFloat(this.squareSizeInput.value) || 30) / 1000.0; // 转换为米
        const blurKernelSize = parseInt(this.blurKernelSizeInput.value) || 5;
        const qualityCheckLevel = parseInt(this.qualityCheckLevelInput.value) || 1;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                action: 'set_board_size',
                width: width,
                height: height,
                square_size: squareSize,
                blur_kernel_size: blurKernelSize,
                quality_check_level: qualityCheckLevel
            };
            this.ws.send(JSON.stringify(message));
            
            const statusText = window.i18n ? 
                `已设置棋盘格: ${width}×${height}, 方格大小: ${squareSize*1000}mm, 模糊核: ${blurKernelSize}×${blurKernelSize}, 质量级别: ${['严格','平衡','宽松'][qualityCheckLevel]}` :
                `Board size set: ${width}×${height}, square: ${squareSize*1000}mm, blur: ${blurKernelSize}×${blurKernelSize}, quality: ${['Strict','Balanced','Permissive'][qualityCheckLevel]}`;
            this.updateStatus('success', statusText);
        } else {
            this.updateStatus('error', window.i18n ? window.i18n.t('websocket_not_connected') : 'WebSocket not connected');
        }
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
        
        // 修复自动采集按钮状态 - 这是关键修复
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
            
            // 添加更新动画
            this.savedImagesCount.classList.add('updated');
            setTimeout(() => {
                this.savedImagesCount.classList.remove('updated');
            }, 500);
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
        this.performCameraCalibrationBtn.disabled = !this.cameraCalibrationMode || this.calibrationImages < 5;
        this.saveCameraCalibrationBtn.disabled = !this.cameraCalibrated;
        
        // 更新执行标定按钮的提示文本
        if (this.performCameraCalibrationBtn) {
            const span = this.performCameraCalibrationBtn.querySelector('span');
            if (span && this.cameraCalibrationMode) {
                const currentCount = this.currentSessionImages || 0;
                if (currentCount < 5) {
                    const buttonText = window.i18n && window.i18n.getCurrentLanguage() === 'zh' ? 
                        `执行标定 (需要≥5张，当前${currentCount}张)` : 
                        `Perform Calibration (Need ≥5, Current ${currentCount})`;
                    span.textContent = buttonText;
                    span.style.color = '#ffffff';
                    span.style.fontWeight = '600';
                    console.log('Updated perform button text to:', buttonText);
                } else {
                    const buttonText = window.i18n ? 
                        window.i18n.t('perform_calibration') || '执行标定' : 
                        'Perform Calibration';
                    span.textContent = buttonText;
                    span.style.color = '#ffffff';
                    span.style.fontWeight = '600';
                    console.log('Updated perform button text to:', buttonText);
                }
            }
        }
        
        // 添加缺少的自动采集按钮状态更新
        if (this.startAutoCalibrationBtn) {
            this.startAutoCalibrationBtn.disabled = !this.cameraCalibrationMode;
        }
        
        if (this.stopAutoCalibrationBtn) {
            this.stopAutoCalibrationBtn.disabled = true; // 默认禁用，只有在自动采集开始后才启用
        }
        
        // 设置其他按钮状态
        this.setButtonState(this.saveCameraCalibrationBtn, this.cameraCalibrated ? 'active' : '');
        
        // 显示图像数量信息  
        if (this.cameraCalibrationMode && this.lastOperation) {
            const currentCount = this.currentSessionImages || 0;
            const message = window.i18n ? 
                `${window.i18n.t('current_image_count')}: ${currentCount}` :
                `Current image count: ${currentCount}`;
            this.lastOperation.textContent = message;
        }
        
        // 更新分辨率显示
        this.updateResolutionDisplay();
    }
    
    updateResolutionDisplay() {
        // 根据标定模式更新性能模式显示
        if (this.performanceMode) {
            if (this.cameraCalibrationMode) {
                this.performanceMode.textContent = window.i18n ? 
                    window.i18n.t('dual_resolution') || '双分辨率' : '双分辨率';
                this.performanceMode.className = 'info-value status-dual';
            } else {
                this.performanceMode.textContent = window.i18n ? 
                    window.i18n.t('single_resolution') || '单分辨率' : '单分辨率';
                this.performanceMode.className = 'info-value';
            }
        }
        
        // 动态更新显示分辨率（在标定模式下降低到960x540）
        if (this.displayResolution) {
            if (this.cameraCalibrationMode) {
                this.displayResolution.textContent = '960×540';
                this.displayResolution.classList.add('updated');
                setTimeout(() => {
                    this.displayResolution.classList.remove('updated');
                }, 500);
            } else {
                this.displayResolution.textContent = '1920×1080';
            }
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
                    console.error('❌ [VIDEO] Failed to load frame:', e);
                };
                
                this.video.src = url;
            } else {
                console.error('❌ [VIDEO] Video element not found');
            }
            
        } catch (error) {
            console.error('❌ [VIDEO] Error in displayImageFrame:', error);
        }
    }

    // 添加自动采集方法
    startAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ [WEBSOCKET] Not connected for auto capture');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        // 自动采集前直接开始新会话，不需要额外的用户操作
        const duration = parseInt(this.autoCaptureTimeInput.value) || 10;
        const interval = parseInt(this.autoCaptureIntervalInput.value) || 500;
        
        console.log(`🚀 [AUTO CAPTURE] Starting: ${duration}s duration, ${interval}ms interval`);
        
        // 设置处理状态
        this.setButtonState(this.startAutoCalibrationBtn, 'processing');
        
        // 保存采集参数
        this.autoCaptureIntervalMs = interval;

        const message = {
            action: 'start_auto_calibration_capture',
            duration: duration,
            interval: interval
        };
        
        console.log('📤 [WEBSOCKET] Sending auto capture message:', message);
        this.ws.send(JSON.stringify(message));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('starting_auto_capture', {duration: duration, interval: interval}) : 
                `Starting auto capture for ${duration}s with ${interval}ms interval`;
            this.lastOperation.textContent = text;
        }
        
        // 启动倒计时显示
        this.startCountdown(duration, interval);
        
        this.updateStatus('info', '开始自动采集标定图片');
    }

    stopAutoCalibrationCapture() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            this.updateStatus('error', 'WebSocket not connected');
            return;
        }
        
        const stopMessage = {
            action: 'stop_auto_calibration_capture'
        };
        
        console.log('Sending stop auto capture message:', stopMessage);
        this.ws.send(JSON.stringify(stopMessage));
        
        if (this.lastOperation) {
            const text = window.i18n ? 
                window.i18n.t('stopping_auto_capture') : 
                'Stopping auto capture';
            this.lastOperation.textContent = text;
        }
        
        this.updateStatus('info', '停止自动采集');
        
        // 停止倒计时
        this.stopCountdown();
    }
    
    // 启动倒计时功能
    startCountdown(durationSeconds, intervalMs) {
        // 设置时间参数
        this.autoCaptureStartTime = Date.now();
        this.autoCaptureEndTime = this.autoCaptureStartTime + (durationSeconds * 1000);
        this.lastCaptureTime = this.autoCaptureStartTime;
        
        // 显示倒计时区域
        if (this.countdownDisplay) {
            this.countdownDisplay.style.display = 'block';
        }
        
        // 启动倒计时更新
        this.countdownInterval = setInterval(() => {
            this.updateCountdown(intervalMs);
        }, 100); // 每100ms更新一次显示
        
        console.log('Countdown started for', durationSeconds, 'seconds');
    }
    
    // 停止倒计时功能
    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // 隐藏倒计时区域
        if (this.countdownDisplay) {
            this.countdownDisplay.style.display = 'none';
        }
        
        console.log('Countdown stopped');
    }
    
    // 更新倒计时显示
    updateCountdown(intervalMs) {
        const now = Date.now();
        
        // 计算剩余时间
        const remainingMs = Math.max(0, this.autoCaptureEndTime - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        
        // 计算下次采集倒计时
        const timeSinceLastCapture = now - this.lastCaptureTime;
        const nextCaptureMs = Math.max(0, intervalMs - timeSinceLastCapture);
        const nextCaptureSeconds = Math.ceil(nextCaptureMs / 1000);
        
        // 计算进度百分比
        const totalMs = this.autoCaptureEndTime - this.autoCaptureStartTime;
        const elapsedMs = now - this.autoCaptureStartTime;
        const progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
        
        // 更新显示
        if (this.remainingTime) {
            this.remainingTime.textContent = `${remainingSeconds}s`;
            this.remainingTime.className = 'countdown-value';
            if (remainingSeconds <= 5) {
                this.remainingTime.className += ' warning';
            }
        }
        
        if (this.nextCaptureTime) {
            this.nextCaptureTime.textContent = `${nextCaptureSeconds}s`;
            this.nextCaptureTime.className = 'countdown-value';
        }
        
        if (this.captureProgress) {
            this.captureProgress.textContent = `${Math.round(progressPercent)}%`;
            this.captureProgress.className = 'countdown-value progress';
        }
        
        // 检查是否结束
        if (remainingMs <= 0) {
            this.stopCountdown();
        }
    }

    // 请求当前标定状态
    requestCurrentStatus() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📋 [STATUS REQUEST] Sending get_calibration_status...');
            this.ws.send(JSON.stringify({
                action: 'get_calibration_status'
            }));
            
            // 显示WebSocket连接状态信息
            console.log('🔗 [WEBSOCKET DEBUG] Connection details:', {
                readyState: this.ws.readyState,
                url: this.ws.url,
                protocol: this.ws.protocol,
                connected: this.connected
            });
        } else {
            console.warn('❌ [STATUS REQUEST] WebSocket not connected, readyState:', this.ws ? this.ws.readyState : 'null');
        }
    }

    showCalibrationCleanupDialog(calibrationError) {
        // 根据标定误差确定建议的处理方式
        let qualityLevel, recommendation, bgColor;
        
        if (calibrationError < 1.0) {
            qualityLevel = '优秀';
            recommendation = 'excellent';
            bgColor = '#d4edda';
        } else if (calibrationError < 2.0) {
            qualityLevel = '良好';
            recommendation = 'good';
            bgColor = '#fff3cd';
        } else {
            qualityLevel = '需要改进';
            recommendation = 'poor';
            bgColor = '#f8d7da';
        }
        
        // 创建对话框HTML
        const dialogHtml = `
            <div id="calibrationCleanupDialog" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            ">
                <div style="
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                ">
                    <h3 style="margin-top: 0; text-align: center; color: #333;">
                        🎯 相机标定完成
                    </h3>
                    
                    <div style="
                        background: ${bgColor};
                        border-radius: 6px;
                        padding: 15px;
                        margin: 20px 0;
                        text-align: center;
                    ">
                        <strong>标定质量：${qualityLevel}</strong><br>
                        <span style="font-size: 14px;">重投影误差：${calibrationError.toFixed(3)} 像素</span>
                    </div>
                    
                    <p style="margin: 20px 0; line-height: 1.6; color: #555;">
                        当前有 <strong>${this.calibrationImages}</strong> 张标定图片。
                        根据标定质量，建议您选择相应的处理方式：
                    </p>
                    
                    <div style="margin: 20px 0;">
                        <button id="cleanupExcellent" class="cleanup-option-btn" data-type="excellent" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #28a745;
                            background: ${recommendation === 'excellent' ? '#28a745' : 'white'};
                            color: ${recommendation === 'excellent' ? 'white' : '#28a745'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            ✅ 优秀处理 - 备份并清理，保留少量验证图片
                        </button>
                        
                        <button id="cleanupGood" class="cleanup-option-btn" data-type="good" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #ffc107;
                            background: ${recommendation === 'good' ? '#ffc107' : 'white'};
                            color: ${recommendation === 'good' ? 'white' : '#ffc107'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            ⚠️ 良好处理 - 备份并选择性保留质量好的图片
                        </button>
                        
                        <button id="cleanupPoor" class="cleanup-option-btn" data-type="poor" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #dc3545;
                            background: ${recommendation === 'poor' ? '#dc3545' : 'white'};
                            color: ${recommendation === 'poor' ? 'white' : '#dc3545'};
                            border-radius: 4px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            🔄 重新采集 - 备份问题图片并完全清理
                        </button>
                        
                        <button id="cleanupBackup" class="cleanup-option-btn" data-type="backup" style="
                            width: 100%;
                            margin: 8px 0;
                            padding: 12px;
                            border: 2px solid #6c757d;
                            background: white;
                            color: #6c757d;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            💾 仅备份 - 保持现状，只做备份
                        </button>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <button id="cleanupLater" style="
                            padding: 10px 20px;
                            border: 1px solid #ccc;
                            background: white;
                            color: #666;
                            border-radius: 4px;
                            cursor: pointer;
                            margin-right: 10px;
                        ">
                            稍后处理
                        </button>
                        
                        <button id="cleanupManual" style="
                            padding: 10px 20px;
                            border: 1px solid #007bff;
                            background: #007bff;
                            color: white;
                            border-radius: 4px;
                            cursor: pointer;
                        ">
                            手动处理
                        </button>
                    </div>
                    
                    <p style="font-size: 12px; color: #888; text-align: center; margin-top: 15px;">
                        💡 建议：根据标定质量选择对应颜色的选项
                    </p>
                </div>
            </div>
        `;
        
        // 添加对话框到页面
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        
        // 绑定事件处理器
        const dialog = document.getElementById('calibrationCleanupDialog');
        
        // 选项按钮事件
        document.querySelectorAll('.cleanup-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                this.executeCleanup(type);
                this.closeCleanupDialog();
            });
        });
        
        // 稍后处理按钮
        document.getElementById('cleanupLater').addEventListener('click', () => {
            this.closeCleanupDialog();
        });
        
        // 手动处理按钮
        document.getElementById('cleanupManual').addEventListener('click', () => {
            this.updateStatus('info', '请在终端中运行：./cleanup_calibration.sh [选项]');
            this.closeCleanupDialog();
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                this.closeCleanupDialog();
            }
        });
    }
    
    closeCleanupDialog() {
        const dialog = document.getElementById('calibrationCleanupDialog');
        if (dialog) {
            dialog.remove();
        }
    }
    
    executeCleanup(type) {
        // 发送清理请求到后端
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                action: 'cleanup_calibration_images',
                cleanup_type: type
            };
            this.ws.send(JSON.stringify(message));
            this.updateStatus('info', `正在执行${type}级别的图片清理...`);
        } else {
            this.updateStatus('error', 'WebSocket连接不可用，请手动执行清理');
        }
    }
    


    // 切换相机校正状态
    toggleCameraCorrection(enabled) {
        console.log(`📸 [CAMERA CORRECTION] Toggling to: ${enabled}`);
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ [CAMERA CORRECTION] WebSocket not connected');
            // 重置开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = !enabled;
            }
            return;
        }

        // 更新状态显示为加载中
        this.updateCorrectionStatus('loading');

        // 发送切换命令到后端
        this.send({
            action: 'toggle_camera_correction',
            enabled: enabled
        });
    }

    // 更新校正状态显示
    updateCorrectionStatus(status, enabled = false) {
        if (!this.correctionStatus) return;

        const statusElement = this.correctionStatus.querySelector('.status-text');
        if (!statusElement) return;

        // 清除现有的状态类
        this.correctionStatus.classList.remove('active', 'inactive', 'loading');

        switch (status) {
            case 'active':
                this.correctionStatus.classList.add('active');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_active') : '校正已激活';
                break;
            case 'inactive':
                this.correctionStatus.classList.add('inactive');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_inactive') : '校正未激活';
                break;
            case 'loading':
                this.correctionStatus.classList.add('loading');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_switching') : '状态切换中...';
                break;
            default:
                this.correctionStatus.classList.add('inactive');
                statusElement.textContent = window.i18n ? window.i18n.t('correction_inactive') : '校正未激活';
        }
    }

    // 处理相机校正状态切换响应
    handleCameraCorrectionToggled(data) {
        console.log('📸 [CAMERA CORRECTION] Received toggle response:', data);
        
        if (data.success) {
            const enabled = data.enabled;
            const status = enabled ? 'active' : 'inactive';
            
            // 更新开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = enabled;
            }
            
            // 更新状态显示
            this.updateCorrectionStatus(status);
            
            // 更新全局状态消息
            const message = enabled ? 
                (window.i18n ? window.i18n.t('correction_enabled') : '相机校正已启用') :
                (window.i18n ? window.i18n.t('correction_disabled') : '相机校正已禁用');
            this.updateStatus('success', message);
            
            console.log(`✅ [CAMERA CORRECTION] Successfully ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            // 切换失败，恢复开关状态
            if (this.enableCameraCorrectionToggle) {
                this.enableCameraCorrectionToggle.checked = !this.enableCameraCorrectionToggle.checked;
            }
            
            // 显示错误状态
            this.updateCorrectionStatus('inactive');
            
            const errorMsg = data.error || '相机校正状态切换失败';
            this.updateStatus('error', errorMsg);
            
            console.error('❌ [CAMERA CORRECTION] Toggle failed:', errorMsg);
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
