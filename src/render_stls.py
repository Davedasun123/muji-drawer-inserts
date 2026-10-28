"""Offscreen render of a row of STLs, for eyeballing generated parts."""
import sys
import vtk


def load(path, offset):
    r = vtk.vtkSTLReader()
    r.SetFileName(path)
    r.Update()
    pd = r.GetOutput()
    t = vtk.vtkTransform()
    t.Translate(*offset)
    f = vtk.vtkTransformPolyDataFilter()
    f.SetInputData(pd)
    f.SetTransform(t)
    f.Update()
    return f.GetOutput()


def main(paths, out='/tmp/tools_render.png'):
    ren = vtk.vtkRenderer()
    ren.SetBackground(0.96, 0.96, 0.95)
    rw = vtk.vtkRenderWindow()
    rw.SetOffScreenRendering(1)
    rw.SetSize(2000, 1100)
    rw.SetMultiSamples(8)
    rw.AddRenderer(ren)

    offsets = [(i * 140 - 70 * (len(paths) - 1), 0, 0) for i in range(len(paths))]
    for p, o in zip(paths, offsets):
        pd = load(p, o)
        n = vtk.vtkPolyDataNormals()
        n.SetInputData(pd)
        n.SetFeatureAngle(35)
        n.Update()
        m = vtk.vtkPolyDataMapper()
        m.SetInputConnection(n.GetOutputPort())
        a = vtk.vtkActor()
        a.SetMapper(m)
        a.GetProperty().SetColor(0.78, 0.82, 0.87)
        a.GetProperty().SetAmbient(0.32)
        a.GetProperty().SetDiffuse(0.72)
        ren.AddActor(a)

        e = vtk.vtkFeatureEdges()
        e.SetInputData(pd)
        e.SetFeatureAngle(30)
        e.BoundaryEdgesOff()
        e.Update()
        em = vtk.vtkPolyDataMapper()
        em.SetInputConnection(e.GetOutputPort())
        ea = vtk.vtkActor()
        ea.SetMapper(em)
        ea.GetProperty().SetColor(0.25, 0.29, 0.35)
        ren.AddActor(ea)

    lk = vtk.vtkLight()
    lk.SetPosition(0.4, -1.0, 1.1)
    lk.SetFocalPoint(0, 0, 0)
    lk.SetIntensity(1.0)
    ren.AddLight(lk)
    lk2 = vtk.vtkLight()
    lk2.SetPosition(-1.0, 0.6, 0.5)
    lk2.SetFocalPoint(0, 0, 0)
    lk2.SetIntensity(0.3)
    ren.AddLight(lk2)

    cam = ren.GetActiveCamera()
    b = ren.ComputeVisiblePropBounds()
    ctr = [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2]
    ext = max(b[1] - b[0], b[3] - b[2], b[5] - b[4])
    cam.SetFocalPoint(*ctr)
    cam.SetPosition(ctr[0] + ext * 0.25, ctr[1] - ext * 1.15, ctr[2] + ext * 0.85)
    cam.SetViewUp(0, 0, 1)
    cam.ParallelProjectionOn()
    cam.SetParallelScale(ext * 0.42)
    cam.OrthogonalizeViewUp()
    ren.ResetCameraClippingRange()
    rw.Render()

    w2i = vtk.vtkWindowToImageFilter()
    w2i.SetInput(rw)
    w2i.Update()
    w = vtk.vtkPNGWriter()
    w.SetFileName(out)
    w.SetInputConnection(w2i.GetOutputPort())
    w.Write()
    print('wrote', out)


if __name__ == '__main__':
    main(sys.argv[1:] or [f'out/tools/tool_0{i}.stl' for i in range(1, 6)])
