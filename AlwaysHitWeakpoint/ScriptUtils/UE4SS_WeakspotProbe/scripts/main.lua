local MOD = "[WeakspotProbe]"

local targets = {
    "/Game/Items/Assets/BP_PlayerBullet.BP_PlayerBullet_C:F_ApplyDamages",
    "/Game/Items/Assets/BP_ArrowProjectile.BP_ArrowProjectile_C:F_IsCritical",
    "/Game/Items/Assets/SheriffStar/BP_SheriffStarProjectile.BP_SheriffStarProjectile_C:F_IsCritical",
    "/Game/Enemies/BP_Enemy.BP_Enemy_C:F_HitMarkerRequest",
    "/Game/Enemies/BP_Enemy.BP_Enemy_C:F_HitMarkerUI",
}

local registered = {}

local function read_param(param)
    if param == nil then
        return "<nil>"
    end

    local ok, value = pcall(function() return param:get() end)
    if not ok then
        ok, value = pcall(function() return param:Get() end)
    end
    if not ok then
        value = param
    end

    if type(value) == "userdata" then
        local name_ok, name = pcall(function() return value:GetFullName() end)
        if name_ok then
            return name
        end
    end

    return tostring(value)
end

local function try_register(function_path)
    if registered[function_path] then
        return
    end

    local ok, pre_id, post_id = pcall(RegisterHook, function_path, function(context, ...)
        print(string.format("%s %s\n", MOD, function_path))
        print(string.format("%s   self=%s\n", MOD, read_param(context)))

        local params = { ... }
        for i, param in ipairs(params) do
            print(string.format("%s   p%d=%s\n", MOD, i, read_param(param)))
        end
    end)

    if ok then
        registered[function_path] = { pre_id, post_id }
        print(string.format("%s registered %s\n", MOD, function_path))
    else
        print(string.format("%s waiting for %s: %s\n", MOD, function_path, tostring(pre_id)))
    end
end

local function register_all()
    for _, function_path in ipairs(targets) do
        try_register(function_path)
    end
end

print(MOD .. " loaded\n")

RegisterBeginPlayPostHook(function()
    register_all()
end)

ExecuteWithDelay(10000, function()
    register_all()
end)
