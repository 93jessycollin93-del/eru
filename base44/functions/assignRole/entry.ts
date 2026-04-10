import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can assign roles
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userEmail, roleId, roleName, expiresAt, scopeData, notes } = body;

    if (!userEmail || !roleId || !roleName) {
      return Response.json(
        { error: 'Missing required fields: userEmail, roleId, roleName' },
        { status: 400 }
      );
    }

    // Step 1: Verify role exists
    const roleCheck = await base44.asServiceRole.entities.CustomRole.filter(
      { id: roleId },
      null,
      1
    );

    if (!roleCheck || roleCheck.length === 0) {
      return Response.json({ error: 'Role not found' }, { status: 404 });
    }

    // Step 2: Deactivate any existing assignments for this user
    const existingAssignments = await base44.asServiceRole.entities.RoleAssignment.filter(
      { user_email: userEmail, is_active: true }
    );

    for (const assignment of existingAssignments) {
      await base44.asServiceRole.entities.RoleAssignment.update(assignment.id, {
        is_active: false,
      });
    }

    // Step 3: Create new role assignment
    const assignment = await base44.asServiceRole.entities.RoleAssignment.create({
      user_email: userEmail,
      custom_role_id: roleId,
      role_name: roleName,
      assigned_by: user.email,
      assigned_at: new Date().toISOString(),
      expires_at: expiresAt || null,
      is_active: true,
      scope_data: scopeData || {},
      notes: notes || '',
    });

    // Step 4: Log the action
    await base44.asServiceRole.entities.SecurityAuditLog.create({
      event_type: 'admin_action',
      user_email: user.email,
      status: 'success',
      severity: 'warning',
      details: {
        action: 'role_assignment',
        target_user: userEmail,
        role: roleName,
        assignment_id: assignment.id,
      },
    });

    return Response.json({
      success: true,
      assignment: {
        id: assignment.id,
        user_email: userEmail,
        role_name: roleName,
        assigned_at: assignment.assigned_at,
      },
    });
  } catch (error) {
    console.error('Role assignment error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});