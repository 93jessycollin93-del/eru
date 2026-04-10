import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function applyVariables(content, variables, fallbackContext) {
  let output = content || '';
  const merged = {
    user_name: fallbackContext.user_name || '',
    context: fallbackContext.context || '',
    ...(variables || {}),
  };

  Object.entries(merged).forEach(([key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    output = output.replace(pattern, value ?? '');
  });

  return output;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateId, variables, context } = await req.json();
    const template = await base44.entities.PromptTemplate.get(templateId);
    const rendered = applyVariables(template.content, variables, {
      user_name: user.full_name || user.email || '',
      context: context || '',
    });

    return Response.json({
      rendered_prompt: rendered,
      template_name: template.name,
      variables: template.variables || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});