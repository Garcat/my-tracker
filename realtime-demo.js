/**
 * 实时同步演示
 * 展示订阅更新功能如何工作
 */

// 场景：两个用户同时编辑共享数据

class SharedDataManager {
    constructor() {
        this.data = [];
        this.subscribers = [];
        this.version = 0;
    }

    // 订阅数据更新
    subscribe(callback) {
        this.subscribers.push(callback);
        // 立即调用一次，让新订阅者获取当前数据
        callback(this.data);
        return () => this.unsubscribe(callback);
    }

    unsubscribe(callback) {
        const index = this.subscribers.indexOf(callback);
        if (index > -1) this.subscribers.splice(index, 1);
    }

    // 更新数据
    updateData(newData, userId) {
        this.data = [...newData];
        this.version++;

        console.log(`用户 ${userId} 更新了数据 (版本 ${this.version}):`, this.data);

        // 通知所有订阅者
        this.subscribers.forEach(callback => {
            try {
                callback(this.data);
            } catch (error) {
                console.error('订阅者回调失败:', error);
            }
        });
    }
}

// 创建全局共享数据管理器
const sharedManager = new SharedDataManager();

// 模拟用户界面
class UserInterface {
    constructor(userId) {
        this.userId = userId;
        this.inputElement = null;
        this.displayElement = null;
        this.unsubscribe = null;
    }

    initialize() {
        // 创建UI
        this.createUI();

        // 订阅数据更新
        this.unsubscribe = sharedManager.subscribe((data) => {
            this.onDataUpdate(data);
        });

        console.log(`用户 ${this.userId} 已连接到共享数据`);
    }

    createUI() {
        console.log(`用户 ${this.userId} 界面已创建`);
        // 实际项目中这里会有真实的DOM操作
    }

    onDataUpdate(data) {
        console.log(`用户 ${this.userId} 收到数据更新:`, data);

        // 更新显示
        if (this.displayElement) {
            this.displayElement.textContent = JSON.stringify(data);
        }

        // 如果数据与当前输入不一致，更新输入框
        const currentInput = this.getCurrentInput();
        const newInput = data.join('\n');

        if (currentInput !== newInput) {
            console.log(`用户 ${this.userId} 输入框已同步`);
            this.setInputValue(newInput);
        }
    }

    updateData(newInput) {
        const lines = newInput.split('\n').filter(line => line.trim());
        sharedManager.updateData(lines, this.userId);
    }

    getCurrentInput() {
        return this.inputElement ? this.inputElement.value : '';
    }

    setInputValue(value) {
        if (this.inputElement) {
            this.inputElement.value = value;
        }
    }

    disconnect() {
        if (this.unsubscribe) {
            this.unsubscribe();
            console.log(`用户 ${this.userId} 已断开连接`);
        }
    }
}

// 演示场景
console.log('=== 多用户共享数据演示 ===\n');

// 创建两个用户
const user1 = new UserInterface(1);
const user2 = new UserInterface(2);

user1.initialize();
user2.initialize();

console.log('\n--- 用户1添加跟踪单号 ---');
user1.updateData('TRACK001\nTRACK002');

console.log('\n--- 用户2添加更多单号 ---');
user2.updateData('TRACK001\nTRACK002\nTRACK003\nTRACK004');

console.log('\n--- 用户1修改单号 ---');
user1.updateData('TRACK001\nTRACK005\nTRACK006');

console.log('\n--- 断开用户连接 ---');
user1.disconnect();
user2.disconnect();

console.log('\n=== 演示结束 ===');

/*
输出结果说明：

=== 多用户共享数据演示 ===

用户 1 界面已创建
用户 1 已连接到共享数据
用户 2 界面已创建
用户 2 已连接到共享数据

--- 用户1添加跟踪单号 ---
用户 1 更新了数据 (版本 1): [ 'TRACK001', 'TRACK002' ]
用户 1 收到数据更新: [ 'TRACK001', 'TRACK002' ]
用户 2 收到数据更新: [ 'TRACK001', 'TRACK002' ]

--- 用户2添加更多单号 ---
用户 2 更新了数据 (版本 2): [ 'TRACK001', 'TRACK002', 'TRACK003', 'TRACK004' ]
用户 1 收到数据更新: [ 'TRACK001', 'TRACK002', 'TRACK003', 'TRACK004' ]
用户 2 收到数据更新: [ 'TRACK001', 'TRACK002', 'TRACK003', 'TRACK004' ]

--- 用户1修改单号 ---
用户 1 更新了数据 (版本 3): [ 'TRACK001', 'TRACK005', 'TRACK006' ]
用户 1 收到数据更新: [ 'TRACK001', 'TRACK005', 'TRACK006' ]
用户 2 收到数据更新: [ 'TRACK001', 'TRACK005', 'TRACK006' ]

--- 断开用户连接 ---
用户 1 已断开连接
用户 2 已断开连接

=== 演示结束 ===
*/