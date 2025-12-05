@echo off
echo Removing @types/minimatch from node_modules...
if exist "node_modules\@types\minimatch" (
    rmdir /s /q "node_modules\@types\minimatch"
    echo Successfully removed @types/minimatch
) else (
    echo @types/minimatch folder not found - may already be removed
)
echo.
echo Done! Try building again with: npm run build
pause

