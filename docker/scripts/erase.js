import fs from "fs";
import path from "path";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: "simulate",
    files: "[]",
    targetDir: "sandbox/target-drive",
    recycleBin: "sandbox/recycle_bin.json",
    reason: "Automated Secure Erasure Execution",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode" && args[i + 1]) {
      options.mode = args[i + 1];
      i++;
    } else if (args[i] === "--files" && args[i + 1]) {
      options.files = args[i + 1];
      i++;
    } else if (args[i] === "--target-dir" && args[i + 1]) {
      options.targetDir = args[i + 1];
      i++;
    } else if (args[i] === "--recycle-bin" && args[i + 1]) {
      options.recycleBin = args[i + 1];
      i++;
    } else if (args[i] === "--reason" && args[i + 1]) {
      options.reason = args[i + 1];
      i++;
    }
  }

  return options;
}

function run() {
  const opts = parseArgs();
  const rootDir = process.cwd();
  const targetDir = path.isAbsolute(opts.targetDir) ? opts.targetDir : path.join(rootDir, opts.targetDir);
  const recycleBinFile = path.isAbsolute(opts.recycleBin) ? opts.recycleBin : path.join(rootDir, opts.recycleBin);

  let fileList = [];
  try {
    fileList = JSON.parse(opts.files);
  } catch (err) {
    console.log(JSON.stringify({ status: "error", message: `Invalid JSON in --files: ${opts.files}` }));
    process.exit(1);
  }

  if (!Array.isArray(fileList) || fileList.length === 0) {
    console.log(JSON.stringify({ status: "error", message: "No files provided in --files parameter" }));
    process.exit(1);
  }

  let totalBytes = 0;
  const eraseList = [];
  const preserveList = [];

  fileList.forEach((fileName) => {
    const fullPath = path.join(targetDir, fileName);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      totalBytes += stats.size;
      eraseList.push(fileName);
    } else {
      preserveList.push(`${fileName} (Not Found)`);
    }
  });

  if (opts.mode === "simulate") {
    const simResult = {
      status: "simulation_success",
      mode: "SIMULATION",
      reason: opts.reason,
      proposed_erasure_count: eraseList.length,
      proposed_preserve_count: preserveList.length,
      reclaimed_bytes: totalBytes,
      erasure_targets: fileList,
      notice: "No files were deleted during simulation mode. Human approval token required for execution.",
    };
    console.log(JSON.stringify(simResult, null, 2));
    process.exit(0);
  }

  if (opts.mode === "execute") {
    const erasedSuccess = [];
    const erasedFailed = [];

    eraseList.forEach((fileName) => {
      const fullPath = path.join(targetDir, fileName);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          if (!fs.existsSync(fullPath)) {
            erasedSuccess.push(fileName);
          } else {
            erasedFailed.push(fileName);
          }
        } catch (err) {
          erasedFailed.push(fileName);
        }
      }
    });

    // Update Recycle Bin JSON if exists
    if (fs.existsSync(recycleBinFile)) {
      try {
        const rbData = JSON.parse(fs.readFileSync(recycleBinFile, "utf-8"));
        const updatedRbData = rbData.filter((item) => !erasedSuccess.includes(item.original_filename));
        fs.writeFileSync(recycleBinFile, JSON.stringify(updatedRbData, null, 2), "utf-8");
      } catch (err) {}
    }

    const execResult = {
      status: "execution_success",
      mode: "EXECUTION",
      reason: opts.reason,
      erased_count: erasedSuccess.length,
      failed_count: erasedFailed.length,
      reclaimed_bytes: totalBytes,
      erased_files: erasedSuccess,
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(execResult, null, 2));
    process.exit(0);
  }

  console.log(JSON.stringify({ status: "error", message: `Invalid mode: ${opts.mode}` }));
  process.exit(1);
}

run();
