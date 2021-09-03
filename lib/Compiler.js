let path = require("path");
let fs = require("fs");
let ejs = require("ejs");
let babylon = require("babylon");  //把源码 转化成ast
let traverse = require("@babel/traverse").default; 
let t = require("@babel/types");
let generator = require("@babel/generator").default;

// babylon 主要就是把源码 转化成ast
// @babel-traverse
// @babel-types
// @babel/generator
class Compiler {
  constructor(config) {
    // entry output
    this.config = config;

    // 需要保存入口文件的路径
    this.entryId; // "./src.index.js"

    // 需要保存所有的模块依赖
    this.modules = {};

    this.entry = config.entry; // 入口路径

    // 工作路径
    this.root = process.cwd();
    plugin 插件就是个clss, 都是new 一下，和vuex的插件开发差不多

// webpack生命周期 钩子函数，在不同周期的时候执行钩子就行
// compile 类 中
// 1. 
 this.hooks = {
  entryOption : New SyncHook(), //入口
  compile: new SyncHook(),  // 编译
  afterCompile: new SyncHook(), // 编译后
  afterPulgins: new SyncHook(), 
  run: new SyncHook(), // 运行
  emit: new SyncHook(),
  done: new SyncHook() //完成
}

// 2. 
let plugins = this.config.plugins;
if(Array.isArray(plugins)) {
  plugins.forEach(plugin => {
    plugin.apply(this) // this 是complier ，传递给插件。类似vue的插件传递Vue
  })
}
// 3. 在Compiler 类中将钩子都执行
this.hooks.afterPlugins.call()
...
...
...
// 插件1 
// class P{
//   apply(compiler) {
//     compiler.hooks.emit.tap('emit',function() {
//       console.log('emit 事件')
//     })
//   }
// }
  }

  // 解析源码
  parse(source, parentPath) {
    // AST解析语法树
    let ast = babylon.parse(source);
    let dependencies = []; // 依赖的数组
    traverse(ast, {
      CallExpression(p) {
        // 调用表达式
        let node = p.node; // 对应的节点
        if (node.callee.name === "require") {
          node.callee.name = "__webpack_require__"; // 【更改require 方法名称】
          let moduleName = node.arguments[0].value; // 就是模块的引用名字
          moduleName = moduleName + (path.extname(moduleName) ? "" : ".js"); 
          moduleName = "./" + path.join(parentPath, moduleName);  //【更改名字】 './src/a.js' 当作key
          dependencies.push(moduleName);
          node.arguments = [t.stringLiteral(moduleName)]; // 在这里就更改了ast上的节点，就替换成js文件中的源码了
        }
      },
    });

    let sourceCode = generator(ast).code;

    return { sourceCode, dependencies };
  }

  getSource(modulePath) {
    let content = fs.readFileSync(modulePath, "utf8");
    let rules = this.config.module.rules;
    for (let i = 0; i < rules.length; i++) {
      let { test, use } = rules[i];
      let len = use.length - 1;
      if (test.test(modulePath)) {
        function normalLoader() {
          let loader = require(use[len--]);
          content = loader(content);
          if (len >= 0) {
            normalLoader();
          }
        }

        normalLoader();
      }
    }
    return content;
  }

  binldModule(modulePath, isEntry) {
    // 拿到模块的内容
    let source = this.getSource(modulePath);
    // 模块id src/index.js
    let moduleName = "./" + path.relative(this.root, modulePath);
    // console.log(source, moduleName);

    if (isEntry) {
      this.entryId = moduleName;
    }
    // 解析需要把source源码进行改造， 返回一个依赖列表
    let { sourceCode, dependencies } = this.parse(
      source,
      path.dirname(moduleName)
    );
    // 把相对路径和模块中的内容 对应起来
    // console.log(sourceCode, dependencies);
    this.modules[moduleName] = sourceCode;

    dependencies.forEach((dep) => {
      this.binldModule(path.join(this.root, dep), false);
    });
  }

  emitFile() {
    // 发射文件
    // 拿到输出的目录
    let main = path.join(this.config.output.path, this.config.output.filename);
    //     ejs模板路径
    let templateStr = this.getSource(path.join(__dirname, "main.ejs")); // ejs 模板引擎，渲染字符串
    let code = ejs.render(templateStr, {
      entryId: this.entryId,
      modules: this.modules,
    });

    this.assets = {};
    this.assets[main] = code;
    console.log(code);
    fs.writeFileSync(main, this.assets[main]);
  }

  run() {
    // 执行 并且创建模块的依赖关系
    this.binldModule(path.resolve(this.root, this.entry), true);
    console.log(this.modules, this.entryId);
    // 发射一个文件， 打包后的文件
    this.emitFile();
  }
}

module.exports = Compiler;
