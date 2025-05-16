/**
 * @Author: Gongxh
 * @Date: 2025-05-14
 * @Description: 通用对象回收池
 * 提供高效的对象复用、内存预分配和自动扩容功能
 * 
 * 设置最大容量, 默认不能超过2048个
 */

export class RecyclePool<T> {
    /** 回收池名称 */
    public name: string = "";

    /** 存储可复用对象的数组 */
    private pool: T[] = [];

    /** 当前池中可用对象的数量 */
    private _count: number = 0;

    /** 池的总容量 */
    private _capacity: number = 0;

    /** 最大容量 */
    private max: number = 2048;

    /** 创建新对象的工厂函数 */
    private factory: () => T;

    /** 重置对象的函数 */
    private reset: (obj: T) => void;

    /** 扩展系数 */
    private expandFactor: number = 1.5;

    /**
     * 创建对象回收池
     * @param factory 创建新对象的工厂函数
     * @param min 初始容量
     * @param reset 重置对象的函数(可选)
     */
    constructor(factory: () => T, reset?: (obj: T) => void, min: number = 32, max: number = 2048) {
        this.max = max;
        this.factory = factory;
        this.reset = reset || ((obj: T) => {/* 默认不做任何操作 */ });
        // 初始化容量
        for (let i = 0; i < min; i++) {
            let a = this.factory();
            this.pool.push(a);
        }
        // 更新容量
        this._capacity = min;
        this._count = min;
    }

    /**
     * 从池中获取一个对象
     * 如果池为空，自动扩展容量
     */
    public pop(): T {
        if (this._count > 0) {
            const obj = this.pool[--this._count]!;
            delete this.pool[this._count];
            return obj;
        }
        // 池中没有对象了 给他加几个
        let count = Math.max(1, Math.ceil(this._capacity * 0.3));
        for (let i = 0; i < count; i++) {
            this.pool[this._count++] = this.factory();
        }
        // 从池中取出对象
        return this.pop();
    }

    /**
     * 回收一个对象到池中
     * @param obj 要归还的对象
     * @returns 是否成功归还
     */
    public insert(obj: T): void {
        if (this._capacity >= this.max) {
            return;
        }
        // 池已满，先扩容再归还
        if (this._count >= this._capacity) {
            this._capacity = Math.min(2048, Math.ceil(this._capacity * this.expandFactor));
            this.pool.length = this._capacity;
            console.log(`回收池【${this.name}】容量扩容: ${this._capacity}`);
        }
        this.reset(obj);
        this.pool[this._count++] = obj;
    }

    /** 
     * 批量回收对象
     */
    public insertBatch(objs: T[]): void {
        let len = objs.length;
        for (let i = 0; i < len; i++) {
            this.insert(objs[i]);
        }
    }

    /**
     * 清空回收池
     */
    public clear(): void {
        // 重置所有已创建的对象
        let len = this._capacity;
        for (let i = 0; i < len; i++) {
            this.reset(this.pool[i]);
        }
        // 重置计数
        this._count = 0;
    }

    /**
     * 获取池中可用对象数量
     */
    public get count(): number {
        return this._count;
    }

    /**
     * 获取池总容量
     */
    public get capacity(): number {
        return this._capacity;
    }
}